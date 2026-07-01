import { buildProject } from '../../scenarios/reaction-timer-fsm/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { serialValue, serialMatches, serialAbsent, pinState } from '../../contracts/dsl';
import type { Contract } from '../../contracts/types';
import type { StimulusEvent } from '../../harness/stimulus';
import type { OneShotScenario } from '../types';

// OS-D3-03. Reaction-timer FSM: START (D2) begins a 1000 ms wait; a STOP (D3) during
// the wait is a false start (print FALSE_START, LED stays off); otherwise the cue LED
// (D8) turns on after 1000 ms and the next STOP prints REACTION_MS=<ms since LED on>.
// Graded on D8 `pin-state` + decoded serial (`serial-value`/`serial-format`). The
// `false-start` variant is the non-blocking enforcer: a blocking delay(1000) misses a
// STOP during the wait and turns the LED on anyway → fails the pin-state contract.
// Both button debounces are 30 ms, so they cancel in the elapsed-time arithmetic:
// REACTION_MS ≈ (STOP press) − (START press) − 1000.
const SCENARIO_DIR = new URL('../../scenarios/reaction-timer-fsm/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const RUN_MS = 2000;
// Establish both buttons RELEASED (HIGH) at t=0 — avr8js starts an external pin
// LOW, so without this a spurious debounced press fires at startup.
const RELEASED: StimulusEvent[] = [
  { kind: 'pin', tMs: 0, pin: 2, level: 1 },
  { kind: 'pin', tMs: 0, pin: 3, level: 1 },
];
/** A debounced press: LOW at tMs held 80 ms, then released. */
const press = (pin: number, tMs: number): StimulusEvent[] => [
  { kind: 'pin', tMs, pin, level: 0 },
  { kind: 'pin', tMs: tMs + 80, pin, level: 1 },
];
// ±30 ms covers loop granularity; a wrong that measures from START is off by ~1000.
const REACTION_TOL = 30;
const reactionValue = (expected: number): Contract =>
  serialValue({
    pattern: /REACTION_MS=(\d+)/,
    expected,
    tolerance: REACTION_TOL,
    formatRegex: /REACTION_MS=\d+\r?\n/,
  });

export const task: OneShotScenario = {
  id: 'reaction-timer-fsm',
  difficulty: 'D3',
  domain: 'state/timing',
  tiers: ['A'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno implementing a reaction timer.\n\n' +
    'The START button is on digital pin 2 and the STOP button on digital pin 3, both to ground; ' +
    'configure both with INPUT_PULLUP and debounce each with a 30 ms stable interval. An ' +
    'active-high cue LED is on digital pin 8. Open Serial at 115200 baud.\n\n' +
    'Start in IDLE with the LED off. An accepted START press begins a 1000 ms waiting period. A ' +
    'STOP press during that period is a false start: cancel the round, keep the LED off, and print ' +
    'exactly FALSE_START. Otherwise, turn the LED on after 1000 ms; the first accepted STOP press ' +
    'after the LED turns on must turn it off and print the elapsed milliseconds since the LED ' +
    'turned on as REACTION_MS=n, then return to IDLE. Ignore extra START presses while a round is ' +
    'active and extra STOP presses while IDLE.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its ' +
    'bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'blocking-wait',
      files: ['wrongs/blocking-wait.ino'],
      expectFailCategory: 'pin-state',
      description: 'Blocks the 1000 ms wait with delay(); misses a false-start STOP and lights the LED anyway.',
    },
    {
      id: 'measures-from-start',
      files: ['wrongs/measures-from-start.ino'],
      expectFailCategory: 'serial-value',
      description: 'Times from the START press (includes the 1000 ms wait) instead of from LED-on.',
    },
  ],
  variants: [
    {
      id: 'normal-reaction',
      description: 'START, wait 1000 ms, LED on, STOP 500 ms later → REACTION_MS≈530.',
      budgetMs: RUN_MS,
      stimulus: [...RELEASED, ...press(2, 100), ...press(3, 1630)],
      contract: [
        pinState(8, 0, { window: { fromMs: 50, toMs: 1050 } }), // off in IDLE + WAITING
        pinState(8, 1, { window: { fromMs: 1250, toMs: 1600 } }), // on in REACT until STOP
        pinState(8, 0, { window: { fromMs: 1750, toMs: RUN_MS } }), // off after STOP
        ...reactionValue(530),
        serialAbsent(/FALSE_START/),
      ],
    },
    {
      id: 'false-start',
      description: 'STOP during the 1000 ms wait → FALSE_START, LED never turns on (non-blocking enforcer).',
      budgetMs: 1400,
      stimulus: [...RELEASED, ...press(2, 100), ...press(3, 600)],
      contract: [
        serialMatches(/FALSE_START\r?\n/),
        pinState(8, 0, { window: { fromMs: 50, toMs: 1400 } }), // LED never on
        serialAbsent(/REACTION_MS/),
      ],
    },
    {
      id: 'ignore-extra-start',
      description: 'An extra START during the wait is ignored; timing is from the first START.',
      budgetMs: RUN_MS,
      stimulus: [...RELEASED, ...press(2, 100), ...press(2, 500), ...press(3, 1630)],
      contract: [
        pinState(8, 1, { window: { fromMs: 1250, toMs: 1600 } }),
        ...reactionValue(530),
      ],
    },
    {
      id: 'ignore-stop-idle',
      description: 'A STOP while IDLE is ignored (no FALSE_START); a later normal round still works.',
      budgetMs: 2200,
      stimulus: [...RELEASED, ...press(3, 100), ...press(2, 400), ...press(3, 1900)],
      contract: [
        pinState(8, 1, { window: { fromMs: 1550, toMs: 1900 } }),
        ...reactionValue(500),
        serialAbsent(/FALSE_START/),
      ],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  // Base contract (bare runner, no press): stays IDLE — LED off, no serial.
  contract: [
    pinState(8, 0, { window: { fromMs: 50, toMs: RUN_MS } }),
    serialAbsent(/FALSE_START|REACTION_MS/),
  ],
};

export default task;
