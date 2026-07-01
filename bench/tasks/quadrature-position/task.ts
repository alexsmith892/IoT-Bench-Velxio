import { buildProject } from '../../scenarios/quadrature-position/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { serialMatches, serialAbsent, serialValue } from '../../contracts/dsl';
import type { StimulusEvent } from '../../harness/stimulus';
import type { OneShotScenario } from '../types';

// OS-D3-02. Decode a detented quadrature encoder (A=D2, B=D3, INPUT_PULLUP). CW =
// from A=1 B=1, A goes low first. One line per completed detent ("POS=n DIR=CW/CCW");
// nothing for intermediate/invalid/bouncing steps. Graded by the value/format split
// on POS (`serial-value` — kills a count-every-edge solution) plus the literal line
// (`serial-format`), and a silent invalid-rejection variant (kills a solution that
// doesn't validate the Gray sequence).
const SCENARIO_DIR = new URL('../../scenarios/quadrature-position/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const RUN_MS = 800;
const STEP = 25;

// Drive A(D2)/B(D3) to a state (levels a,b) at tMs.
const st = (tMs: number, a: 0 | 1, b: 0 | 1): StimulusEvent[] => [
  { kind: 'pin', tMs, pin: 2, level: a },
  { kind: 'pin', tMs, pin: 3, level: b },
];
const RELEASED = st(0, 1, 1); // both channels HIGH at rest

// A sequence of AB states stepped every STEP ms starting at startMs.
const seq = (startMs: number, states: Array<[0 | 1, 0 | 1]>): StimulusEvent[] =>
  states.flatMap((ab, i) => st(startMs + i * STEP, ab[0], ab[1]));

// One CW detent (11→01→00→10→11) / CCW detent (11→10→00→01→11), returning to rest.
const CW: Array<[0 | 1, 0 | 1]> = [[0, 1], [0, 0], [1, 0], [1, 1]];
const CCW: Array<[0 | 1, 0 | 1]> = [[1, 0], [0, 0], [0, 1], [1, 1]];
const cw = (startMs: number) => seq(startMs, CW);
const ccw = (startMs: number) => seq(startMs, CCW);

export const task: OneShotScenario = {
  id: 'quadrature-position',
  difficulty: 'D3',
  domain: 'state/event-decode',
  tiers: ['A'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno that decodes a mechanical quadrature ' +
    'rotary encoder.\n\n' +
    'Channels A and B are on digital pins 2 and 3; configure both with INPUT_PULLUP. The encoder ' +
    'produces standard quadrature. Define clockwise as the direction in which, starting from A=1 ' +
    'B=1, channel A goes low first (to A=0 B=1). Count one detent per complete cycle: +1 and ' +
    'direction CW for clockwise rotation, -1 and CCW for the reverse. Start at position 0. Ignore ' +
    'invalid or incomplete transitions and contact bounce.\n\n' +
    'At 115200 baud, print exactly one line per completed valid detent:\n' +
    'POS=1 DIR=CW\n' +
    'or\n' +
    'POS=-1 DIR=CCW\n\n' +
    'Print nothing for intermediate transitions or invalid/bouncing sequences.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its ' +
    'bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'count-every-edge',
      files: ['wrongs/count-every-edge.ino'],
      expectFailCategory: 'serial-value',
      description: 'Counts every channel transition instead of one per detent, so POS is ~4× too large.',
    },
    {
      id: 'no-invalid-reject',
      files: ['wrongs/no-invalid-reject.ino'],
      expectFailCategory: 'serial-format',
      description: 'Does not validate the Gray sequence: counts invalid two-bit jumps and wiggles as detents.',
    },
  ],
  variants: [
    {
      id: 'cw-one',
      description: 'One clockwise detent → POS=1 DIR=CW.',
      budgetMs: RUN_MS,
      stimulus: [...RELEASED, ...cw(150)],
      contract: [
        ...serialValue({
          pattern: /POS=(-?\d+) DIR=/,
          expected: 1,
          tolerance: 0,
          formatRegex: /POS=1 DIR=CW\r?\n/,
        }),
      ],
    },
    {
      id: 'ccw-one',
      description: 'One counter-clockwise detent → POS=-1 DIR=CCW.',
      budgetMs: RUN_MS,
      stimulus: [...RELEASED, ...ccw(150)],
      contract: [
        ...serialValue({
          pattern: /POS=(-?\d+) DIR=/,
          expected: -1,
          tolerance: 0,
          formatRegex: /POS=-1 DIR=CCW\r?\n/,
        }),
      ],
    },
    {
      id: 'cw-multi',
      description: 'Three clockwise detents in a row → POS=1, 2, 3 (repeat/boundary).',
      budgetMs: RUN_MS,
      stimulus: [...RELEASED, ...cw(150), ...cw(300), ...cw(450)],
      contract: [
        ...serialValue({
          pattern: /POS=(-?\d+) DIR=/,
          expected: 3,
          tolerance: 0,
          formatRegex: /POS=3 DIR=CW\r?\n/,
        }),
        serialMatches(/POS=1 DIR=CW\r?\n/),
        serialMatches(/POS=2 DIR=CW\r?\n/),
      ],
    },
    {
      id: 'invalid-rejection',
      description: 'An incomplete forward-then-reverse cycle and a bounce burst → NO output at all.',
      budgetMs: RUN_MS,
      stimulus: [
        ...RELEASED,
        // partial CW then reverse back to rest, all single-bit: 11→01→00→01→11 (nets 0)
        ...seq(150, [[0, 1], [0, 0], [0, 1], [1, 1]]),
        // channel-A bounce chatter: 11→01→11→01→11 (nets 0)
        ...seq(400, [[0, 1], [1, 1], [0, 1], [1, 1]]),
      ],
      contract: [serialAbsent(/POS=/)], // kills no-invalid-reject (it emits on these)
    },
    {
      id: 'recover-after-invalid',
      description: 'An incomplete wiggle, then a clean CW detent → exactly POS=1 (recovery).',
      budgetMs: RUN_MS,
      stimulus: [
        ...RELEASED,
        ...seq(120, [[0, 1], [1, 1]]), // incomplete wiggle 11→01→11 (ignored)
        ...cw(350),                    // a valid CW detent → POS=1
      ],
      contract: [
        ...serialValue({
          pattern: /POS=(-?\d+) DIR=/,
          expected: 1,
          tolerance: 0,
          formatRegex: /POS=1 DIR=CW\r?\n/,
        }),
      ],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  // Base contract (bare runner, channels undriven): no detents decoded.
  contract: [serialAbsent(/POS=/)],
};

export default task;
