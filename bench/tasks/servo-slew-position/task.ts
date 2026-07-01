import { buildProject } from '../../scenarios/servo-slew-position/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { servoAngle, pinFrequency } from '../../contracts/assertions';
import { serialMatches, serialAbsent } from '../../contracts/dsl';
import type { OneShotScenario } from '../types';

// OS-D3-06. Directly generate a 50 Hz servo pulse train on D9 (no Servo lib):
// 1000µs=0° … 2000µs=180°, start 90°. Serial "POS n" retargets; the angle SLEWS
// toward the target at ≤90°/s (never jumps). Graded on the decoded pulse width
// (`servoAngle`/`pulse-width`) at a steady post-slew window AND a mid-slew window
// (the instant-jump discriminator), the 50 Hz train continuity (`frequency`, the
// blocking discriminator), and the literal replies (`serial-format`).
const SCENARIO_DIR = new URL('../../scenarios/servo-slew-position/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const RUN_MS = 2000;
const cmd = (tMs: number, data: string) => ({ kind: 'serial' as const, tMs, data });

export const task: OneShotScenario = {
  id: 'servo-slew-position',
  difficulty: 'D3',
  domain: 'actuator/timing',
  tiers: ['B'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno that drives a hobby servo on digital pin 9 ' +
    'by directly generating a 50 Hz pulse train, without the Servo library.\n\n' +
    'Emit one pulse every 20 ms. A pulse width of 1000 microseconds corresponds to 0 degrees and ' +
    '2000 microseconds to 180 degrees, mapped linearly between. The servo starts at 90 degrees.\n\n' +
    'Open Serial at 115200 baud and accept LF- or CRLF-terminated commands of the exact form POS n, ' +
    'where n is a decimal integer from 0 through 180. A valid command sets the target angle and ' +
    'replies OK POS=n; a malformed command or out-of-range value changes nothing and replies ERR.\n\n' +
    'The output must not jump instantly to a new target: slew the current angle toward the target at ' +
    'no more than 90 degrees per second, updating the generated pulse width as it moves, then hold ' +
    'once reached. The pulse train must keep running at 50 Hz and serial must stay responsive ' +
    'throughout.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its ' +
    'bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'instant-jump',
      files: ['wrongs/instant-jump.ino'],
      expectFailCategory: 'pulse-width',
      description: 'Jumps straight to the target with no slew; mid-move the pulse width is already at target.',
    },
    {
      id: 'blocking-slew',
      files: ['wrongs/blocking-slew.ino'],
      expectFailCategory: 'frequency',
      description: 'Slews inside a blocking delay() loop, so the 50 Hz pulse train stalls during a move.',
    },
  ],
  variants: [
    {
      id: 'move-up',
      description: 'POS 180 → slew 90°→180° at 90°/s (~1 s); mid-slew must be intermediate, not instant.',
      budgetMs: RUN_MS,
      stimulus: [cmd(100, 'POS 180\n')],
      contract: [
        pinFrequency(9, { hz: 50, window: { fromMs: 200, toMs: 1000 } }), // train continuous during slew
        servoAngle(9, { angleDeg: 121.5, tolDeg: 10, window: { fromMs: 400, toMs: 500 } }), // mid-slew (kills instant-jump)
        servoAngle(9, { angleDeg: 180, window: { fromMs: 1400, toMs: 1900 } }), // settled
        serialMatches(/OK POS=180\r?\n/),
      ],
    },
    {
      id: 'move-down',
      description: 'POS 0 → slew 90°→0° at 90°/s; boundary target 0° (1000µs).',
      budgetMs: RUN_MS,
      stimulus: [cmd(100, 'POS 0\n')],
      contract: [
        pinFrequency(9, { hz: 50, window: { fromMs: 200, toMs: 1000 } }),
        servoAngle(9, { angleDeg: 58.5, tolDeg: 10, window: { fromMs: 400, toMs: 500 } }),
        servoAngle(9, { angleDeg: 0, window: { fromMs: 1400, toMs: 1900 } }),
        serialMatches(/OK POS=0\r?\n/),
      ],
    },
    {
      id: 'retarget',
      description: 'POS 180 then POS 90 mid-slew → reverses toward the new target and holds at 90°.',
      budgetMs: RUN_MS,
      stimulus: [cmd(100, 'POS 180\n'), cmd(500, 'POS 90\n')],
      contract: [
        servoAngle(9, { angleDeg: 90, window: { fromMs: 1300, toMs: 1900 } }), // back to 90° and held
        serialMatches(/OK POS=180\r?\n/),
        serialMatches(/OK POS=90\r?\n/),
      ],
    },
    {
      id: 'boundary-invalid',
      description: 'POS 45 valid, then out-of-range / non-decimal / missing-arg → ERR and no movement.',
      budgetMs: RUN_MS,
      stimulus: [
        cmd(100, 'POS 45\n'),
        cmd(800, 'POS 200\n'),   // out of range → ERR
        cmd(1000, 'POS abc\n'),  // non-decimal → ERR
        cmd(1200, 'POS\n'),      // missing arg → ERR
      ],
      contract: [
        servoAngle(9, { angleDeg: 45, window: { fromMs: 1400, toMs: 1900 } }), // invalids didn't move it
        serialMatches(/OK POS=45\r?\n/),
        serialMatches(/ERR\r?\n/),
      ],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  // Base contract (bare runner, no command): holds 90° (1500µs), 50 Hz, no reply.
  contract: [
    servoAngle(9, { angleDeg: 90, window: { fromMs: 200, toMs: RUN_MS } }),
    pinFrequency(9, { hz: 50, window: { fromMs: 100, toMs: RUN_MS } }),
    serialAbsent(/OK|ERR/),
  ],
};

export default task;
