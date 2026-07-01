import { buildProject } from '../../scenarios/appliance-cycle-fsm/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { serialMatches, serialAbsent, pinState } from '../../contracts/dsl';
import type { StimulusEvent } from '../../harness/stimulus';
import type { OneShotScenario } from '../types';

// OS-D3-04. Cancelable appliance cycle FSM. Door D2 (closed = LOW), START/CANCEL
// button D3 (30 ms debounce). Active-high FILL D6 (300 ms) → MOTOR/"WASH" D7 (600 ms)
// → DRAIN D8 (300 ms) → DONE. Abort within 20 ms if the door opens or the button is
// pressed mid-cycle. A start with the door open prints STATE=DOOR_OPEN. Graded on the
// driven output levels (`pin-state`) + decoded STATE=… serial (`serial-format`). The
// `door-abort` variant is the non-blocking enforcer: a delay()-per-stage solution
// can't abort within 20 ms so the motor keeps running.
const SCENARIO_DIR = new URL('../../scenarios/appliance-cycle-fsm/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const RUN_MS = 1800;
// Button RELEASED (HIGH) at t=0 — avr8js starts an external pin LOW, so without this
// a spurious debounced press fires at startup. Door level is set per variant.
const btnReleased: StimulusEvent = { kind: 'pin', tMs: 0, pin: 3, level: 1 };
const door = (tMs: number, closed: boolean): StimulusEvent => ({ kind: 'pin', tMs, pin: 2, level: closed ? 0 : 1 });
/** A debounced button press: LOW at tMs held 80 ms, then released. */
const press = (tMs: number): StimulusEvent[] => [
  { kind: 'pin', tMs, pin: 3, level: 0 },
  { kind: 'pin', tMs: tMs + 80, pin: 3, level: 1 },
];

export const task: OneShotScenario = {
  id: 'appliance-cycle-fsm',
  difficulty: 'D3',
  domain: 'state',
  tiers: ['A'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno implementing a cancelable appliance cycle ' +
    'as a state machine.\n\n' +
    'The door switch on digital pin 2 is closed when LOW; configure it with INPUT_PULLUP. The ' +
    'START/CANCEL button on digital pin 3 is wired to ground, uses INPUT_PULLUP, and is debounced ' +
    'with a 30 ms stable interval. The active-high outputs are FILL on pin 6, MOTOR on pin 7, and ' +
    'DRAIN on pin 8. Open Serial at 115200 baud.\n\n' +
    'All outputs start LOW in IDLE. A button press while IDLE starts a cycle only if the door is ' +
    'closed. Run these states in order, without overlap: FILL HIGH for 300 ms, then MOTOR HIGH for ' +
    '600 ms, then DRAIN HIGH for 300 ms. On each state entry print exactly STATE=FILL, STATE=WASH, ' +
    'or STATE=DRAIN. At normal completion set every output LOW, print STATE=DONE, and return to ' +
    'IDLE.\n\n' +
    'If the door opens during a cycle, or the button is pressed during a cycle, abort within 20 ms: ' +
    'set all outputs LOW, print STATE=ABORT, and return to IDLE. A start attempt with the door open ' +
    'leaves outputs LOW and prints STATE=DOOR_OPEN.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its ' +
    'bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'blocking-states',
      files: ['wrongs/blocking-states.ino'],
      expectFailCategory: 'pin-state',
      description: 'Runs each stage with delay(); cannot abort within 20 ms when the door opens.',
    },
    {
      id: 'no-door-check',
      files: ['wrongs/no-door-check.ino'],
      expectFailCategory: 'serial-format',
      description: 'Starts the cycle regardless of the door; no STATE=DOOR_OPEN when the door is open.',
    },
  ],
  variants: [
    {
      id: 'normal-cycle',
      description: 'Door closed, one press → FILL 300 ms, WASH 600 ms, DRAIN 300 ms, DONE.',
      budgetMs: RUN_MS,
      stimulus: [btnReleased, door(0, true), ...press(200)],
      contract: [
        serialMatches(/STATE=FILL\r?\n/),
        serialMatches(/STATE=WASH\r?\n/),
        serialMatches(/STATE=DRAIN\r?\n/),
        serialMatches(/STATE=DONE\r?\n/),
        pinState(6, 1, { window: { fromMs: 280, toMs: 520 } }), // FILL ~230–530
        pinState(7, 1, { window: { fromMs: 580, toMs: 1120 } }), // WASH ~530–1130
        pinState(8, 1, { window: { fromMs: 1180, toMs: 1420 } }), // DRAIN ~1130–1430
        pinState(6, 0, { window: { fromMs: 1500, toMs: RUN_MS } }),
        pinState(7, 0, { window: { fromMs: 1500, toMs: RUN_MS } }),
        pinState(8, 0, { window: { fromMs: 1500, toMs: RUN_MS } }),
      ],
    },
    {
      id: 'door-abort',
      description: 'Door opens during WASH → abort within 20 ms (all off, STATE=ABORT, no DONE).',
      budgetMs: 1500,
      stimulus: [btnReleased, door(0, true), ...press(200), door(700, false)],
      contract: [
        serialMatches(/STATE=FILL\r?\n/),
        serialMatches(/STATE=WASH\r?\n/),
        serialMatches(/STATE=ABORT\r?\n/),
        serialAbsent(/STATE=DONE/),
        pinState(7, 0, { window: { fromMs: 730, toMs: 1500 } }), // motor off within ~20 ms of the door open
        pinState(6, 0, { window: { fromMs: 730, toMs: 1500 } }),
        pinState(8, 0, { window: { fromMs: 730, toMs: 1500 } }),
      ],
    },
    {
      id: 'button-abort',
      description: 'A second press during WASH cancels the cycle (STATE=ABORT, all off).',
      budgetMs: 1500,
      stimulus: [btnReleased, door(0, true), ...press(200), ...press(700)],
      contract: [
        serialMatches(/STATE=WASH\r?\n/),
        serialMatches(/STATE=ABORT\r?\n/),
        serialAbsent(/STATE=DONE/),
        pinState(7, 0, { window: { fromMs: 780, toMs: 1500 } }),
      ],
    },
    {
      id: 'door-open-start',
      description: 'A start with the door open → STATE=DOOR_OPEN, outputs stay LOW.',
      budgetMs: 800,
      stimulus: [btnReleased, door(0, false), ...press(200)],
      contract: [
        serialMatches(/STATE=DOOR_OPEN\r?\n/),
        serialAbsent(/STATE=FILL/),
        pinState(6, 0, { window: { fromMs: 50, toMs: 800 } }),
        pinState(7, 0, { window: { fromMs: 50, toMs: 800 } }),
        pinState(8, 0, { window: { fromMs: 50, toMs: 800 } }),
      ],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  // Base contract (bare runner, door open by default, no press): everything LOW/idle.
  contract: [
    pinState(6, 0, { window: { fromMs: 50, toMs: RUN_MS } }),
    pinState(7, 0, { window: { fromMs: 50, toMs: RUN_MS } }),
    pinState(8, 0, { window: { fromMs: 50, toMs: RUN_MS } }),
    serialAbsent(/STATE=/),
  ],
};

export default task;
