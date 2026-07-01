import { buildProject } from '../../scenarios/four-mode-indicator/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { pinFrequency, pinDutyCycle } from '../../contracts/assertions';
import { pinState } from '../../contracts/dsl';
import type { StimulusEvent } from '../../harness/stimulus';
import type { OneShotScenario } from '../types';

// OS-D3-01. A debounced button (D2) advances one mode per press: OFF, SLOW 1 Hz,
// MEDIUM 2 Hz, FAST 4 Hz, wrap to OFF. Active-high LED on D4, active buzzer on D3
// pulsed 50 ms per accepted press. Graded on the driven pin levels: per-mode LED
// frequency on D4 (windowed, category `frequency`) + the D3 buzzer pulse (`pin-state`).
// `debounce-and-buzzer` is the careless-solution discriminator (a no-debounce
// solution double-advances on a bounce and lands on the wrong frequency).
const SCENARIO_DIR = new URL('../../scenarios/four-mode-indicator/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const RUN_MS = 3000;
// Button RELEASED (HIGH) at t=0 — avr8js starts an external pin LOW, so without
// this a spurious debounced press fires at startup.
const RELEASED: StimulusEvent[] = [{ kind: 'pin', tMs: 0, pin: 2, level: 1 }];
/** A clean debounced press: LOW at tMs held 80 ms, then released. */
const press = (tMs: number): StimulusEvent[] => [
  { kind: 'pin', tMs, pin: 2, level: 0 },
  { kind: 'pin', tMs: tMs + 80, pin: 2, level: 1 },
];

export const task: OneShotScenario = {
  id: 'four-mode-indicator',
  difficulty: 'D3',
  domain: 'state/timing',
  tiers: ['A'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno implementing a four-mode indicator.\n\n' +
    'A pushbutton from digital pin 2 to ground uses INPUT_PULLUP. An active-high LED is on digital ' +
    'pin 4 and an active buzzer on digital pin 3. Debounce the button with a 30 ms stable interval ' +
    'and advance one mode per press:\n\n' +
    '1. OFF: LED LOW.\n' +
    '2. SLOW: LED blinks at 1 Hz, 50% duty.\n' +
    '3. MEDIUM: LED blinks at 2 Hz, 50% duty.\n' +
    '4. FAST: LED blinks at 4 Hz, 50% duty.\n\n' +
    'After FAST, the next press returns to OFF. Start in OFF. On each accepted press, pulse the ' +
    'buzzer HIGH for 50 ms then LOW. Blinking, debounce, and buzzer timing must run concurrently ' +
    'and uninterrupted.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its ' +
    'bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'wrong-freqs',
      files: ['wrongs/wrong-freqs.ino'],
      expectFailCategory: 'frequency',
      description: 'Each mode blinks one step too fast (SLOW=2 Hz, MEDIUM=4 Hz, FAST=8 Hz).',
    },
    {
      id: 'no-debounce',
      files: ['wrongs/no-debounce.ino'],
      expectFailCategory: 'frequency',
      description: 'Advances on every raw edge; a bounced press double-advances the mode.',
    },
    {
      id: 'no-buzzer',
      files: ['wrongs/no-buzzer.ino'],
      expectFailCategory: 'pin-state',
      description: 'Correct modes/frequencies but never pulses the buzzer.',
    },
  ],
  variants: [
    {
      id: 'slow-mode',
      description: 'One press → SLOW 1 Hz; LED is OFF before the press.',
      budgetMs: RUN_MS,
      stimulus: [...RELEASED, ...press(200)],
      contract: [
        pinState(4, 0, { window: { fromMs: 50, toMs: 180 } }), // OFF before press
        pinFrequency(4, { hz: 1, window: { fromMs: 700, toMs: 2800 } }),
        pinDutyCycle(4, { duty: 0.5, window: { fromMs: 700, toMs: 2800 } }),
      ],
    },
    {
      id: 'medium-mode',
      description: 'Two presses → MEDIUM 2 Hz.',
      budgetMs: 2900,
      stimulus: [...RELEASED, ...press(200), ...press(450)],
      contract: [
        pinFrequency(4, { hz: 2, window: { fromMs: 760, toMs: 2760 } }),
        pinDutyCycle(4, { duty: 0.5, window: { fromMs: 760, toMs: 2760 } }),
      ],
    },
    {
      id: 'fast-mode',
      description: 'Three presses → FAST 4 Hz.',
      budgetMs: 2900,
      stimulus: [...RELEASED, ...press(200), ...press(450), ...press(700)],
      contract: [
        pinFrequency(4, { hz: 4, window: { fromMs: 900, toMs: 2700 } }),
        pinDutyCycle(4, { duty: 0.5, window: { fromMs: 900, toMs: 2700 } }),
      ],
    },
    {
      id: 'wrap-and-off',
      description: 'Four presses → wraps to OFF (LED low); a fifth press → SLOW again (boundary/repeat).',
      budgetMs: 5000,
      stimulus: [...RELEASED, ...press(200), ...press(450), ...press(700), ...press(950), ...press(2200)],
      contract: [
        pinState(4, 0, { window: { fromMs: 1150, toMs: 2100 } }), // OFF after the 4th press
        pinFrequency(4, { hz: 1, window: { fromMs: 2700, toMs: 4800 } }), // SLOW after the 5th
      ],
    },
    {
      id: 'debounce-and-buzzer',
      description:
        'A bounced press counts once → SLOW (a no-debounce solution double-advances to MEDIUM); ' +
        'the buzzer pulses HIGH for ~50 ms on the accepted press.',
      budgetMs: RUN_MS,
      stimulus: [
        { kind: 'pin', tMs: 0, pin: 2, level: 1 },
        { kind: 'pin', tMs: 200, pin: 2, level: 0 }, // bounce burst then settle LOW
        { kind: 'pin', tMs: 203, pin: 2, level: 1 },
        { kind: 'pin', tMs: 206, pin: 2, level: 0 },
        { kind: 'pin', tMs: 400, pin: 2, level: 1 }, // release
      ],
      contract: [
        pinFrequency(4, { hz: 1, window: { fromMs: 700, toMs: 2800 } }), // one advance → SLOW
        pinState(3, 1, { atMs: 255 }), // buzzer HIGH during the ~50 ms pulse
        pinState(3, 0, { atMs: 360 }), // buzzer LOW after the pulse
      ],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  // Base contract (bare runner, no press): stays in OFF — LED and buzzer low.
  contract: [
    pinState(4, 0, { window: { fromMs: 50, toMs: RUN_MS } }),
    pinState(3, 0, { window: { fromMs: 50, toMs: RUN_MS } }),
  ],
};

export default task;
