import { buildProject } from '../../scenarios/dual-input-safety-enable/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { pinState } from '../../contracts/dsl';
import type { OneShotScenario } from '../types';

// OS-D1-02. Two switches to GND on D4/D5 (INPUT_PULLUP → closed = LOW); active-high
// ENABLE on D8 is HIGH only while BOTH are closed. Graded on the driven D8 level
// (category `pin-state`). The `single-input` variant is the AND-vs-OR discriminator.
const SCENARIO_DIR = new URL('../../scenarios/dual-input-safety-enable/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const RUN_MS = 1000;

export const task: OneShotScenario = {
  id: 'dual-input-safety-enable',
  difficulty: 'D1',
  domain: 'GPIO/logic',
  tiers: ['A'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno implementing a two-input safety ' +
    'interlock.\n\n' +
    'Digital pins 4 and 5 each connect to a normally-open switch to ground; configure both with ' +
    'INPUT_PULLUP, so a closed switch reads LOW. Digital pin 8 is an active-high ENABLE output.\n\n' +
    'ENABLE is HIGH only while both switches are closed at the same time, and LOW for every other ' +
    'combination, including at startup. Update the output continuously and reflect an input change ' +
    'within 10 ms. Debouncing is not required.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its ' +
    'bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'or-logic',
      files: ['wrongs/or-logic.ino'],
      expectFailCategory: 'pin-state',
      description: 'Enables on either switch (OR) instead of both (AND).',
    },
    {
      id: 'stuck-enabled',
      files: ['wrongs/stuck-enabled.ino'],
      expectFailCategory: 'pin-state',
      description: 'Hardcoded ENABLE permanently HIGH.',
    },
  ],
  variants: [
    {
      id: 'both-then-open-one',
      description: 'Low at startup, HIGH when both close, LOW again when one opens.',
      budgetMs: RUN_MS,
      stimulus: [
        { kind: 'pin', tMs: 0, pin: 4, level: 1 },
        { kind: 'pin', tMs: 0, pin: 5, level: 1 },
        { kind: 'pin', tMs: 100, pin: 4, level: 0 }, // both close
        { kind: 'pin', tMs: 100, pin: 5, level: 0 },
        { kind: 'pin', tMs: 400, pin: 4, level: 1 }, // open one
      ],
      contract: [
        pinState(8, 0, { atMs: 60 }), // LOW at startup
        pinState(8, 1, { window: { fromMs: 150, toMs: 350 } }), // both closed → HIGH
        pinState(8, 0, { window: { fromMs: 450, toMs: 650 } }), // one open → LOW
      ],
    },
    {
      id: 'single-input-only',
      description: 'Each switch alone must NOT enable (kills an OR solution); both does.',
      budgetMs: RUN_MS,
      stimulus: [
        { kind: 'pin', tMs: 0, pin: 4, level: 1 },
        { kind: 'pin', tMs: 0, pin: 5, level: 1 },
        { kind: 'pin', tMs: 100, pin: 4, level: 0 }, // SW1 only
        { kind: 'pin', tMs: 250, pin: 4, level: 1 },
        { kind: 'pin', tMs: 350, pin: 5, level: 0 }, // SW2 only
        { kind: 'pin', tMs: 500, pin: 5, level: 1 },
        { kind: 'pin', tMs: 600, pin: 4, level: 0 }, // both
        { kind: 'pin', tMs: 600, pin: 5, level: 0 },
      ],
      contract: [
        pinState(8, 0, { window: { fromMs: 140, toMs: 240 } }), // SW1 only → LOW
        pinState(8, 0, { window: { fromMs: 390, toMs: 490 } }), // SW2 only → LOW
        pinState(8, 1, { window: { fromMs: 650, toMs: 850 } }), // both → HIGH
      ],
    },
    {
      id: 'repeated-both-cycles',
      description: 'Two both-closed/open cycles — ENABLE tracks each (repeat theme).',
      budgetMs: RUN_MS,
      stimulus: [
        { kind: 'pin', tMs: 0, pin: 4, level: 1 },
        { kind: 'pin', tMs: 0, pin: 5, level: 1 },
        { kind: 'pin', tMs: 100, pin: 4, level: 0 },
        { kind: 'pin', tMs: 100, pin: 5, level: 0 },
        { kind: 'pin', tMs: 250, pin: 4, level: 1 },
        { kind: 'pin', tMs: 250, pin: 5, level: 1 },
        { kind: 'pin', tMs: 400, pin: 4, level: 0 },
        { kind: 'pin', tMs: 400, pin: 5, level: 0 },
        { kind: 'pin', tMs: 550, pin: 4, level: 1 },
        { kind: 'pin', tMs: 550, pin: 5, level: 1 },
      ],
      contract: [
        pinState(8, 1, { window: { fromMs: 140, toMs: 240 } }),
        pinState(8, 0, { window: { fromMs: 290, toMs: 390 } }),
        pinState(8, 1, { window: { fromMs: 440, toMs: 540 } }),
        pinState(8, 0, { window: { fromMs: 600, toMs: 800 } }),
      ],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  // Base contract (bare runner, no stimulus → both switches open): ENABLE stays LOW.
  contract: [pinState(8, 0, { window: { fromMs: 50, toMs: RUN_MS } })],
};

export default task;
