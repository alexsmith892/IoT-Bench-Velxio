import { buildProject } from '../../scenarios/cooperative-scheduler/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { pinFrequency, pinDutyCycle, edgeCount } from '../../contracts/assertions';
import { serialMatches, serialAbsent, pinState } from '../../contracts/dsl';
import type { StimulusEvent } from '../../harness/stimulus';
import type { OneShotScenario } from '../types';

// OS-D3-10. Four concurrent 50%-duty blinks (D4=1, D5=2, D6=3, D7=5 Hz) + a button
// mirror on D8 + PAUSE/RESUME over serial. Graded on: per-pin `frequency`/`duty`,
// the D8 mirror `pin-state` (responsive within 20 ms, even while paused — the
// blocking discriminator), a freeze while paused via `edge-count`=0 (the no-freeze
// discriminator), and correct-frequency resume after RESUME. Exact edge-for-edge
// phase-continuity is intentionally NOT asserted (see reflections/pass-09.md §1) —
// freeze + correct resume + no in-pause edges capture the meaningful behavior.
const SCENARIO_DIR = new URL('../../scenarios/cooperative-scheduler/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const RUN_MS = 2500;
// Button RELEASED (HIGH) at t=0 — avr8js starts an external pin LOW.
const RELEASED: StimulusEvent[] = [{ kind: 'pin', tMs: 0, pin: 2, level: 1 }];
const press = (tMs: number): StimulusEvent => ({ kind: 'pin', tMs, pin: 2, level: 0 });
const release = (tMs: number): StimulusEvent => ({ kind: 'pin', tMs, pin: 2, level: 1 });
const cmd = (tMs: number, data: string): StimulusEvent => ({ kind: 'serial', tMs, data });

const FREQS: Array<[number, number]> = [[4, 1], [5, 2], [6, 3], [7, 5]];

export const task: OneShotScenario = {
  id: 'cooperative-scheduler',
  difficulty: 'D3',
  domain: 'timing/concurrency',
  tiers: ['B'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno running four independent blink schedules ' +
    'and one responsive input concurrently.\n\n' +
    'Active-high LEDs blink at 50% duty: pin 4 at 1 Hz, pin 5 at 2 Hz, pin 6 at 3 Hz, and pin 7 at ' +
    '5 Hz. All four start LOW and begin their first period together at startup. A button on digital ' +
    'pin 2 uses INPUT_PULLUP; an active-high response LED on digital pin 8 mirrors it (on while ' +
    'pressed, off while released) and reacts within 20 ms regardless of what the four schedules are ' +
    'doing.\n\n' +
    'Open Serial at 115200 baud. The command PAUSE freezes all four blink outputs at their current ' +
    'levels and stops their schedules; RESUME continues them so that each LED\'s phase is preserved ' +
    '— the pattern simply shifts later by the paused duration, with no burst of catch-up edges. The ' +
    'response LED on pin 8 keeps mirroring the button even while paused. PAUSE replies OK PAUSED and ' +
    'RESUME replies OK RUNNING; any other input replies ERR. A second PAUSE while paused (or RESUME ' +
    'while running) changes nothing and repeats the same reply.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its ' +
    'bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'blocking-delay',
      files: ['wrongs/blocking-delay.ino'],
      expectFailCategory: 'pin-state',
      description: 'Ends every loop with delay(50), so the D8 button mirror lags far past the 20 ms bound.',
    },
    {
      id: 'no-freeze',
      files: ['wrongs/no-freeze.ino'],
      expectFailCategory: 'edge-count',
      description: 'Replies OK PAUSED but keeps advancing the schedule, so the LEDs blink through a pause.',
    },
    {
      id: 'phase-restart',
      files: ['wrongs/phase-restart.ino'],
      expectFailCategory: 'pin-state',
      description: 'Freezes and resumes at the right rate but restarts every phase from 0 on RESUME.',
    },
  ],
  variants: [
    {
      id: 'baseline',
      description: 'All four LEDs blink at their frequencies, in phase, starting LOW.',
      budgetMs: RUN_MS,
      stimulus: [...RELEASED],
      contract: [
        ...FREQS.flatMap(([pin, hz]) => [
          pinFrequency(pin, { hz, window: { fromMs: 100, toMs: 2400 } }),
          pinDutyCycle(pin, { duty: 0.5, window: { fromMs: 100, toMs: 2400 } }),
        ]),
        pinState(4, 0, { window: { fromMs: 50, toMs: 400 } }), // 1 Hz LED starts LOW (first half period)
      ],
    },
    {
      id: 'button-mirror',
      description: 'Press → D8 on within 20 ms, off on release; the blinks keep running uninterrupted.',
      budgetMs: RUN_MS,
      stimulus: [...RELEASED, press(500), release(1500)],
      contract: [
        pinState(8, 0, { window: { fromMs: 100, toMs: 450 } }),   // off before press
        pinState(8, 1, { window: { fromMs: 525, toMs: 1450 } }),  // on within ~20 ms of press (kills blocking-delay)
        pinState(8, 0, { window: { fromMs: 1600, toMs: 2400 } }), // off after release
        pinFrequency(7, { hz: 5, window: { fromMs: 100, toMs: 2400 } }), // schedules uninterrupted
      ],
    },
    {
      id: 'pause-freeze',
      description: 'PAUSE freezes all four (no edges); the mirror still works while paused; RESUME resumes.',
      budgetMs: 2800,
      stimulus: [...RELEASED, cmd(700, 'PAUSE\n'), press(900), release(1300), cmd(1700, 'RESUME\n')],
      contract: [
        pinFrequency(7, { hz: 5, window: { fromMs: 100, toMs: 650 } }),  // running before pause
        edgeCount(7, { max: 0, window: { fromMs: 780, toMs: 1650 } }),   // 5 Hz frozen (kills no-freeze)
        edgeCount(4, { max: 0, window: { fromMs: 780, toMs: 1650 } }),   // 1 Hz frozen
        pinState(8, 1, { window: { fromMs: 960, toMs: 1250 } }),         // mirror works WHILE paused
        pinFrequency(7, { hz: 5, window: { fromMs: 1800, toMs: 2700 } }), // 5 Hz resumes
        // Phase-continuity: D4 (1 Hz) is mid-HIGH when PAUSE lands (~700 ms) and,
        // preserved, stays HIGH past RESUME (~1700 ms) until its natural fall at
        // ~2000 ms. A phase-restart solution resets to phase 0 (LOW) at resume and
        // fails here — the only place the "phase is preserved" clause is graded.
        pinState(4, 1, { window: { fromMs: 1730, toMs: 1960 } }),
        serialMatches(/OK PAUSED\r?\n/),
        serialMatches(/OK RUNNING\r?\n/),
      ],
    },
    {
      id: 'idempotent-and-err',
      description: 'Double PAUSE/RESUME repeat the same reply and change nothing; junk replies ERR.',
      budgetMs: 1900,
      stimulus: [
        ...RELEASED,
        cmd(400, 'PAUSE\n'),
        cmd(600, 'PAUSE\n'),   // idempotent → OK PAUSED again, still frozen
        cmd(900, 'RESUME\n'),
        cmd(1100, 'RESUME\n'), // idempotent → OK RUNNING again
        cmd(1300, 'FOO\n'),    // unknown → ERR
      ],
      contract: [
        edgeCount(7, { max: 0, window: { fromMs: 470, toMs: 860 } }),      // frozen across both PAUSEs
        serialMatches(/OK PAUSED\r?\n[\s\S]*OK PAUSED\r?\n/),              // replied twice
        serialMatches(/OK RUNNING\r?\n[\s\S]*OK RUNNING\r?\n/),
        serialMatches(/ERR\r?\n/),
        pinFrequency(7, { hz: 5, window: { fromMs: 1200, toMs: 1850 } }), // running again after RESUME
      ],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  // Base contract (bare runner, button undriven): the four blinks run at their
  // frequencies and D4 starts LOW. (D8 mirrors the undriven button, so it is not
  // asserted here.)
  contract: [
    ...FREQS.map(([pin, hz]) => pinFrequency(pin, { hz, window: { fromMs: 100, toMs: 2400 } })),
    pinState(4, 0, { window: { fromMs: 50, toMs: 400 } }),
    serialAbsent(/OK|ERR/),
  ],
};

export default task;
