import { buildProject } from '../../scenarios/debounced-toggle/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { pinState } from '../../contracts/dsl';
import type { OneShotScenario } from '../types';

// OS-D2-02. Button D2 (INPUT_PULLUP → pressed = LOW); active-low LED D7 (LOW = on).
// Toggle exactly once per DEBOUNCED press (>=30 ms stable); bounce must not add
// toggles and holding must not repeat. Graded on the driven D7 level (category
// `pin-state`). This task has NO concurrent behaviour, so a blocking (delay-based)
// solution is a fully valid answer — no non-blocking requirement is smuggled in
// (one-shot-task-bank.md §5). The `bounce-rejected` variant is the debounce
// discriminator; `multi-press` proves the latch toggles, not follows.
const SCENARIO_DIR = new URL('../../scenarios/debounced-toggle/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const RUN_MS = 1000;
// D7 is active-low: HIGH = LED off, LOW = LED on.
const OFF = 1 as const;
const ON = 0 as const;

export const task: OneShotScenario = {
  id: 'debounced-toggle',
  difficulty: 'D2',
  domain: 'timing/state',
  tiers: ['A'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno. A pushbutton from digital pin 2 to ' +
    'ground uses INPUT_PULLUP. An active-low LED is on digital pin 7.\n\n' +
    'The LED starts off. Toggle it exactly once per button press. A press or release counts only ' +
    'after the input has been stable for at least 30 ms; shorter bounce must not cause extra ' +
    'toggles, and holding the button must not toggle repeatedly — a further toggle requires a ' +
    'debounced release followed by a new debounced press.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its ' +
    'bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'no-debounce',
      files: ['wrongs/no-debounce.ino'],
      expectFailCategory: 'pin-state',
      description: 'Toggles on every raw falling edge; contact bounce adds extra toggles.',
    },
    {
      id: 'level-follow',
      files: ['wrongs/level-follow.ino'],
      expectFailCategory: 'pin-state',
      description: 'LED follows the button level instead of latching a toggle.',
    },
  ],
  variants: [
    {
      id: 'single-toggle',
      description: 'One clean press → LED latches ON and STAYS on after release (kills level-follow).',
      budgetMs: 700,
      stimulus: [
        { kind: 'pin', tMs: 0, pin: 2, level: 1 }, // released
        { kind: 'pin', tMs: 200, pin: 2, level: 0 }, // press
        { kind: 'pin', tMs: 400, pin: 2, level: 1 }, // release
      ],
      contract: [
        pinState(7, OFF, { atMs: 120 }), // off at startup
        pinState(7, ON, { window: { fromMs: 300, toMs: 680 } }), // latched on through release
      ],
    },
    {
      id: 'bounce-rejected',
      description:
        'A bouncing press (two 1→0 edges within 6 ms) must count as ONE press; a naive edge ' +
        'toggler double-counts and lands OFF. Then a second clean press turns it OFF.',
      budgetMs: RUN_MS,
      stimulus: [
        { kind: 'pin', tMs: 0, pin: 2, level: 1 },
        // bounce burst then settle LOW (pressed):
        { kind: 'pin', tMs: 200, pin: 2, level: 0 },
        { kind: 'pin', tMs: 203, pin: 2, level: 1 },
        { kind: 'pin', tMs: 206, pin: 2, level: 0 },
        { kind: 'pin', tMs: 400, pin: 2, level: 1 }, // debounced release
        { kind: 'pin', tMs: 600, pin: 2, level: 0 }, // second clean press
        { kind: 'pin', tMs: 800, pin: 2, level: 1 },
      ],
      contract: [
        pinState(7, ON, { window: { fromMs: 300, toMs: 560 } }), // 1 debounced toggle → ON
        pinState(7, OFF, { window: { fromMs: 680, toMs: 980 } }), // 2nd press → OFF
      ],
    },
    {
      id: 'hold-no-repeat',
      description: 'A long hold produces exactly one toggle; the LED must not flicker while held.',
      budgetMs: RUN_MS,
      stimulus: [
        { kind: 'pin', tMs: 0, pin: 2, level: 1 },
        { kind: 'pin', tMs: 200, pin: 2, level: 0 }, // press and hold
        { kind: 'pin', tMs: 700, pin: 2, level: 1 }, // release
      ],
      contract: [
        pinState(7, ON, { window: { fromMs: 280, toMs: 980 } }), // stays on, no repeat
      ],
    },
    {
      id: 'multi-press',
      description: 'Three debounced presses → LED cycles on/off/on (repeat theme).',
      budgetMs: RUN_MS,
      stimulus: [
        { kind: 'pin', tMs: 0, pin: 2, level: 1 },
        { kind: 'pin', tMs: 150, pin: 2, level: 0 },
        { kind: 'pin', tMs: 250, pin: 2, level: 1 },
        { kind: 'pin', tMs: 400, pin: 2, level: 0 },
        { kind: 'pin', tMs: 500, pin: 2, level: 1 },
        { kind: 'pin', tMs: 650, pin: 2, level: 0 },
        { kind: 'pin', tMs: 750, pin: 2, level: 1 },
      ],
      contract: [
        pinState(7, ON, { window: { fromMs: 220, toMs: 380 } }), // after press 1
        pinState(7, OFF, { window: { fromMs: 470, toMs: 620 } }), // after press 2
        pinState(7, ON, { window: { fromMs: 720, toMs: 980 } }), // after press 3
      ],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  // Base contract (bare runner, button released the whole time): LED stays off.
  contract: [pinState(7, OFF, { window: { fromMs: 50, toMs: RUN_MS } })],
};

export default task;
