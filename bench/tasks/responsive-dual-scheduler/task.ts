import { buildProject } from '../../scenarios/responsive-dual-scheduler/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { pinFrequency, pinDutyCycle } from '../../contracts/assertions';
import { pinState } from '../../contracts/dsl';
import type { Contract } from '../../contracts/types';
import type { OneShotScenario } from '../types';

// OS-D2-01. Three concurrent behaviours: LED A (D3) 1 Hz, LED B (D5) 2 Hz, and a
// response LED (D8) that mirrors the button (D2) within 20 ms while both blink
// patterns keep running. Graded on driven pin levels: frequency/duty on D3/D5
// (category `frequency`/`duty`) and D8 responsiveness windows (category
// `pin-state`). The D8 windows are the BEHAVIORAL non-blocking enforcer — a
// delay()-based scheduler samples the button too slowly and fails them, while the
// blink frequencies of such a solution stay correct (one-shot-task-bank.md §5).
const SCENARIO_DIR = new URL('../../scenarios/responsive-dual-scheduler/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const RUN_MS = 2600;

/** Both blink contracts: A at 1 Hz 50%, B at 2 Hz 50%. */
const blinkContract: Contract = [
  pinFrequency(3, { hz: 1 }),
  pinDutyCycle(3, { duty: 0.5 }),
  pinFrequency(5, { hz: 2 }),
  pinDutyCycle(5, { duty: 0.5 }),
];

export const task: OneShotScenario = {
  id: 'responsive-dual-scheduler',
  difficulty: 'D2',
  domain: 'timing/concurrency',
  tiers: ['A'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno running three concurrent behaviors.\n\n' +
    '- LED A (active-high, digital pin 3) blinks at 1 Hz, 50% duty.\n' +
    '- LED B (active-high, digital pin 5) blinks at 2 Hz, 50% duty.\n' +
    '- A button from digital pin 2 to ground uses INPUT_PULLUP. An active-high response LED on ' +
    'digital pin 8 mirrors it — on while pressed, off while released — reacting within 20 ms while ' +
    'both blink patterns continue uninterrupted.\n\n' +
    'All three outputs start LOW.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its ' +
    'bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'blocking-delay',
      files: ['wrongs/blocking-delay.ino'],
      expectFailCategory: 'pin-state',
      description: 'Blocking delay(250) scheduler — correct blink rates, but the button response lags past 20 ms.',
    },
    {
      id: 'swapped-rates',
      files: ['wrongs/swapped-rates.ino'],
      expectFailCategory: 'frequency',
      description: 'Blink rates swapped (A 2 Hz, B 1 Hz); button mirror is fine.',
    },
  ],
  variants: [
    {
      id: 'mirror-while-blinking',
      description:
        'Both LEDs blink; the button is pressed/released several times and D8 must track each ' +
        'edge within 20 ms while the blink patterns keep their rates.',
      budgetMs: RUN_MS,
      stimulus: [
        { kind: 'pin', tMs: 0, pin: 2, level: 1 }, // released
        { kind: 'pin', tMs: 700, pin: 2, level: 0 }, // press
        { kind: 'pin', tMs: 1100, pin: 2, level: 1 }, // release
        { kind: 'pin', tMs: 1500, pin: 2, level: 0 }, // press
        { kind: 'pin', tMs: 1900, pin: 2, level: 1 }, // release
        { kind: 'pin', tMs: 2300, pin: 2, level: 0 }, // press
      ],
      contract: [
        ...blinkContract,
        pinState(8, 0, { atMs: 120 }), // starts low
        pinState(8, 1, { window: { fromMs: 720, toMs: 1080 } }), // responds within 20 ms, holds
        pinState(8, 0, { window: { fromMs: 1120, toMs: 1480 } }),
        pinState(8, 1, { window: { fromMs: 1520, toMs: 1880 } }),
        pinState(8, 0, { window: { fromMs: 1920, toMs: 2280 } }),
        pinState(8, 1, { window: { fromMs: 2320, toMs: 2560 } }),
      ],
    },
    {
      id: 'rapid-toggles',
      description: 'Rapid presses (100 ms apart) — a slow blocking sampler misses them (repeat theme).',
      budgetMs: 2200,
      stimulus: [
        { kind: 'pin', tMs: 0, pin: 2, level: 1 },
        { kind: 'pin', tMs: 600, pin: 2, level: 0 },
        { kind: 'pin', tMs: 700, pin: 2, level: 1 },
        { kind: 'pin', tMs: 800, pin: 2, level: 0 },
        { kind: 'pin', tMs: 900, pin: 2, level: 1 },
        { kind: 'pin', tMs: 1000, pin: 2, level: 0 },
        { kind: 'pin', tMs: 1100, pin: 2, level: 1 },
      ],
      contract: [
        ...blinkContract,
        pinState(8, 1, { window: { fromMs: 620, toMs: 680 } }),
        pinState(8, 0, { window: { fromMs: 720, toMs: 780 } }),
        pinState(8, 1, { window: { fromMs: 820, toMs: 880 } }),
        pinState(8, 0, { window: { fromMs: 920, toMs: 980 } }),
        pinState(8, 1, { window: { fromMs: 1020, toMs: 1080 } }),
        pinState(8, 0, { window: { fromMs: 1120, toMs: 1200 } }),
      ],
    },
    {
      id: 'startup-and-rates',
      description: 'No button activity: all outputs start LOW and both rates hold (boundary theme).',
      budgetMs: RUN_MS,
      stimulus: [{ kind: 'pin', tMs: 0, pin: 2, level: 1 }], // released the whole run
      contract: [
        ...blinkContract,
        pinState(3, 0, { atMs: 100 }), // A low at startup (first toggle at 500 ms)
        pinState(5, 0, { atMs: 100 }), // B low at startup (first toggle at 250 ms)
        pinState(8, 0, { window: { fromMs: 50, toMs: 2560 } }), // response low throughout
      ],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  // Base contract (bare runner, button released): both blink, response stays low.
  contract: [...blinkContract, pinState(8, 0, { window: { fromMs: 50, toMs: RUN_MS } })],
};

export default task;
