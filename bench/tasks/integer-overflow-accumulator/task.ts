import { buildProject } from '../../scenarios/integer-overflow-accumulator/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { serialValue, adcDerivedValue, serialMatches } from '../../contracts/dsl';
import type { Contract } from '../../contracts/types';
import type { OneShotScenario } from '../types';

// OS-D2-05. Line-oriented running stats over Serial @115200: signed ints or RESET,
// reply `N=k SUM=s MIN=lo MAX=hi`, ERR for malformed/out-of-range/overlong. The
// harness injects RX lines and grades the DECODED response fields (semantic)
// separately from the literal line format (§6c). The `overflow` variant is the
// numeric-discipline discriminator: two full-magnitude samples (SUM=40000) overflow
// a 16-bit `int` accumulator, the common AVR bug. The prompt was aligned in the
// post-review pass so it no longer mandates 64-bit (its old "100000 full-magnitude
// samples" clause needed >int32); a 32-bit `long` is now a correct answer and int16
// is the only wrong one — the prompt and the (feasible) behavioral test now agree.
// See reflections/pass-07.md review addendum.
const SCENARIO_DIR = new URL('../../scenarios/integer-overflow-accumulator/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const RUN_MS = 700;
// The full reply line shape (the FORMAT half of the value/format split).
const LINE_FORMAT = /N=\d+ SUM=-?\d+ MIN=-?\d+ MAX=-?\d+\r?\n/;
// Fields are exact integers; ±0.5 only guards float parsing of the captured digits.
const TOL = 0.5;

interface Stats { n: number; sum: number; min: number; max: number; }

/**
 * Grade the LAST reply line: SUM via the value/format split (serial-value +
 * serial-format), and N/MIN/MAX as decoded numbers (adc-value). All patterns pick
 * the last match, i.e. the most recent reply.
 */
function statsContract(s: Stats): Contract {
  return [
    ...serialValue({ pattern: /SUM=(-?\d+)/, expected: s.sum, tolerance: TOL, formatRegex: LINE_FORMAT }),
    // Anchor on a leading boundary so `N=` does not also match inside `MIN=`.
    adcDerivedValue({ pattern: /(?:^|\s)N=(\d+)/, expected: s.n, tolerance: TOL }),
    adcDerivedValue({ pattern: /MIN=(-?\d+)/, expected: s.min, tolerance: TOL }),
    adcDerivedValue({ pattern: /MAX=(-?\d+)/, expected: s.max, tolerance: TOL }),
  ];
}

export const task: OneShotScenario = {
  id: 'integer-overflow-accumulator',
  difficulty: 'D2',
  domain: 'serial/numeric',
  tiers: ['B'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno that maintains running statistics over a ' +
    'stream of integers on Serial at 115200 baud.\n\n' +
    'Accept LF- or CRLF-terminated lines. Each line is either a signed decimal integer from -32768 ' +
    'through 32767, or the exact word RESET. For each accepted integer, update a running count, ' +
    'sum, minimum, and maximum since the last reset, then reply in exactly this form with a ' +
    'newline:\n' +
    'N=k SUM=s MIN=lo MAX=hi\n\n' +
    'The running sum can exceed the range of an individual value and must stay exact as values ' +
    'accumulate. RESET clears all statistics and replies exactly:\n' +
    'N=0 SUM=0 MIN=0 MAX=0\n\n' +
    'A malformed line, empty line, or out-of-range value changes nothing and replies exactly ERR. ' +
    'Recover cleanly from an overlong line by discarding through its terminator and replying ERR ' +
    'once.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its ' +
    'bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'int16-sum',
      files: ['wrongs/int16-sum.ino'],
      expectFailCategory: 'serial-value',
      description: 'Keeps the running sum in a 16-bit int; two full-magnitude samples overflow it.',
    },
    {
      id: 'no-reset',
      files: ['wrongs/no-reset.ino'],
      expectFailCategory: 'serial-value',
      description: 'RESET reports current stats but never zeroes them.',
    },
  ],
  variants: [
    {
      id: 'accumulate-sequence',
      description: 'Three in-range integers → count/sum/min/max tracked (order theme).',
      budgetMs: RUN_MS,
      stimulus: [
        { kind: 'serial', tMs: 50, data: '10\n' },
        { kind: 'serial', tMs: 200, data: '-5\n' },
        { kind: 'serial', tMs: 350, data: '100\n' },
      ],
      contract: statsContract({ n: 3, sum: 105, min: -5, max: 100 }),
    },
    {
      id: 'overflow',
      description: 'Two full-magnitude samples → SUM=40000; overflows a 16-bit accumulator (boundary theme).',
      budgetMs: 500,
      stimulus: [
        { kind: 'serial', tMs: 50, data: '20000\n' },
        { kind: 'serial', tMs: 250, data: '20000\n' },
      ],
      contract: statsContract({ n: 2, sum: 40000, min: 20000, max: 20000 }),
    },
    {
      id: 'reset-clears',
      description: 'Accumulate then RESET → all stats zeroed (repeat/state theme).',
      budgetMs: RUN_MS,
      stimulus: [
        { kind: 'serial', tMs: 50, data: '5\n' },
        { kind: 'serial', tMs: 200, data: '7\n' },
        { kind: 'serial', tMs: 350, data: 'RESET\n' },
      ],
      contract: statsContract({ n: 0, sum: 0, min: 0, max: 0 }),
    },
    {
      id: 'error-recovery',
      description: 'An out-of-range value replies ERR, then a valid value is accepted (recovery theme).',
      budgetMs: 500,
      stimulus: [
        { kind: 'serial', tMs: 50, data: '40000\n' }, // out of range → ERR
        { kind: 'serial', tMs: 250, data: '7\n' }, // accepted
      ],
      contract: [
        serialMatches(/ERR/),
        ...statsContract({ n: 1, sum: 7, min: 7, max: 7 }),
      ],
    },
    {
      id: 'overlong-recovery',
      description: 'An overlong line is discarded with a single ERR, then a valid value is accepted.',
      budgetMs: 500,
      stimulus: [
        { kind: 'serial', tMs: 50, data: '123456789012345678\n' }, // >15 chars → overlong → ERR
        { kind: 'serial', tMs: 250, data: '42\n' }, // accepted after recovery
      ],
      contract: [
        serialMatches(/ERR/),
        ...statsContract({ n: 1, sum: 42, min: 42, max: 42 }),
      ],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  // Base contract (bare runner, no RX): nothing is printed, so require no spurious
  // reply — a single accepted value would be needed to produce a line. With no
  // input the reference stays silent; assert it does not emit a stats line.
  contract: [
    (trace) => {
      const text = trace.serial.map((s) => s.char).join('');
      const pass = !LINE_FORMAT.test(text);
      return {
        name: 'no-spurious-output',
        pass,
        category: 'serial-format',
        reason: pass ? 'no stats line emitted without input' : `unexpected output: ${JSON.stringify(text.slice(0, 40))}`,
      };
    },
  ],
};

export default task;
