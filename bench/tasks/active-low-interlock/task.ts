import { buildProject } from '../../scenarios/active-low-interlock/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { pinState } from '../../contracts/dsl';
import type { OneShotScenario } from '../types';

// OS-D1-01. Button D2 (INPUT_PULLUP) → active-low LED D7 (LOW = on). The LED must
// follow the live button level continuously and start off. Graded purely on the
// driven D7 pin level (category `pin-state`); the stimulus drives the external
// level D2 reads (0 = pressed for a button-to-GND with the internal pullup).
const SCENARIO_DIR = new URL('../../scenarios/active-low-interlock/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const RUN_MS = 1000;

export const task: OneShotScenario = {
  id: 'active-low-interlock',
  difficulty: 'D1',
  domain: 'GPIO/circuit',
  tiers: ['A'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno.\n\n' +
    'A pushbutton on digital pin 2 is wired between the pin and ground; configure it with ' +
    'INPUT_PULLUP, so released reads HIGH and pressed reads LOW. An LED on digital pin 7 is ' +
    'driven through an inverting stage, so it is active-low: writing LOW turns it on, writing ' +
    'HIGH turns it off.\n\n' +
    'The LED must be off at startup. While the button is pressed the LED is on; while released ' +
    'it is off. Follow the current button state continuously; debouncing is not required.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its ' +
    'bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'active-high-polarity',
      files: ['wrongs/active-high-polarity.ino'],
      expectFailCategory: 'pin-state',
      description: 'Treats the LED as active-high (inverted drive).',
    },
    {
      id: 'stuck-on',
      files: ['wrongs/stuck-on.ino'],
      expectFailCategory: 'pin-state',
      description: 'Hardcoded LED permanently on; never reads the button.',
    },
  ],
  variants: [
    {
      id: 'press-release',
      description: 'Off at startup, on while pressed, off again after release.',
      budgetMs: RUN_MS,
      stimulus: [
        { kind: 'pin', tMs: 0, pin: 2, level: 1 }, // released
        { kind: 'pin', tMs: 100, pin: 2, level: 0 }, // press
        { kind: 'pin', tMs: 400, pin: 2, level: 1 }, // release
      ],
      contract: [
        pinState(7, 1, { atMs: 60 }), // off at startup (active-low → HIGH)
        pinState(7, 0, { window: { fromMs: 150, toMs: 350 } }), // on while pressed
        pinState(7, 1, { window: { fromMs: 450, toMs: 650 } }), // off after release
      ],
    },
    {
      id: 'repeated-presses',
      description: 'Three press/release cycles — a toggle-on-edge solution fails here.',
      budgetMs: RUN_MS,
      stimulus: [
        { kind: 'pin', tMs: 0, pin: 2, level: 1 },
        { kind: 'pin', tMs: 100, pin: 2, level: 0 },
        { kind: 'pin', tMs: 200, pin: 2, level: 1 },
        { kind: 'pin', tMs: 350, pin: 2, level: 0 },
        { kind: 'pin', tMs: 450, pin: 2, level: 1 },
        { kind: 'pin', tMs: 600, pin: 2, level: 0 },
        { kind: 'pin', tMs: 700, pin: 2, level: 1 },
      ],
      contract: [
        pinState(7, 0, { window: { fromMs: 140, toMs: 190 } }),
        pinState(7, 1, { window: { fromMs: 250, toMs: 340 } }),
        pinState(7, 0, { window: { fromMs: 390, toMs: 440 } }),
        pinState(7, 0, { window: { fromMs: 640, toMs: 690 } }),
        pinState(7, 1, { window: { fromMs: 750, toMs: 950 } }),
      ],
    },
    {
      id: 'held-from-startup',
      description: 'Button already pressed at boot (boundary); released mid-run.',
      budgetMs: RUN_MS,
      stimulus: [
        { kind: 'pin', tMs: 0, pin: 2, level: 0 }, // pressed at boot
        { kind: 'pin', tMs: 500, pin: 2, level: 1 }, // release
      ],
      contract: [
        pinState(7, 0, { window: { fromMs: 60, toMs: 480 } }), // on while held
        pinState(7, 1, { window: { fromMs: 560, toMs: 950 } }), // off after release
      ],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  // Base contract (used by the bare runner, no stimulus → button released): LED
  // stays off the whole run.
  contract: [pinState(7, 1, { window: { fromMs: 50, toMs: RUN_MS } })],
};

export default task;
