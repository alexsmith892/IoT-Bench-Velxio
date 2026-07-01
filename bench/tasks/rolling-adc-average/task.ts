import { buildProject } from '../../scenarios/rolling-adc-average/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { serialValue } from '../../contracts/dsl';
import type { Assertion, Contract } from '../../contracts/types';
import type { OneShotScenario } from '../types';

// OS-D2-04. A0 sampled every 25 ms → print the truncated integer mean of the last
// eight samples as `AVG=n`. The harness injects the A0 voltage and grades the
// DECODED value (semantic) separately from the literal format (§6c). This task has
// NO concurrent behaviour, so a blocking (delay-based) solution is valid. The
// `changing-input` variant is the hardcode-killer: the average must track to the
// new steady value.
const SCENARIO_DIR = new URL('../../scenarios/rolling-adc-average/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const RUN_MS = 600;
const AVG_PATTERN = /AVG=(\d+)/;
const AVG_FORMAT = /AVG=\d+\r?\n/;
// Volts → steady analogRead(A0) reading (ADC 0..1023 over 0..5 V). The mean of
// eight identical readings is that reading, so the expected AVG is this value.
const readingForVolts = (volts: number) => Math.round((volts / 5) * 1023);
// ±2 absorbs 10-bit quantization and the 1023-vs-1024 divisor; a wrong (fixed or
// undivided sum) is off by hundreds/thousands.
const AVG_TOL = 2;

// The 8th sample lands at ~7×25 = 175 ms (sampling starts at t≈0), so a correct
// solution prints its first AVG no earlier than ~175 ms. Grading that nothing
// appears before 150 ms enforces the "print nothing before the eighth sample"
// clause (a solution that prints from the first sample fails). Comfortably below
// 175 ms, so a correct solution is never clipped.
const QUIET_UNTIL_MS = 150;
const noAvgBeforeQuiet: Assertion = (trace) => {
  const early = trace.serial.filter((s) => s.tMs < QUIET_UNTIL_MS).map((s) => s.char).join('');
  const pass = !/AVG=/.test(early);
  return {
    name: `noAvgBefore(${QUIET_UNTIL_MS}ms)`,
    pass,
    category: 'serial-format',
    reason: pass
      ? `no AVG line before ${QUIET_UNTIL_MS}ms (waits for 8 samples)`
      : `AVG printed before the 8th sample: ${JSON.stringify(early.slice(0, 40))}`,
  };
};

/** The value/format split for a steady AVG derived from the injected A0 voltage. */
function avgContract(expected: number): Contract {
  return [
    ...serialValue({
      pattern: AVG_PATTERN,
      expected,
      tolerance: AVG_TOL,
      formatRegex: AVG_FORMAT,
    }),
    noAvgBeforeQuiet,
  ];
}

export const task: OneShotScenario = {
  id: 'rolling-adc-average',
  difficulty: 'D2',
  domain: 'analog/numeric',
  tiers: ['A'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno that reports a rolling average of an ' +
    'analog signal on A0.\n\n' +
    'Open Serial at 115200 baud. Take one ADC sample every 25 ms. Once eight samples exist, after ' +
    'each new sample print the integer mean (truncated toward zero) of the most recent eight ' +
    'samples, in exactly this form with a newline:\n' +
    'AVG=512\n\n' +
    'Print nothing before the eighth sample. The reported value must track changing input.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its ' +
    'bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'hardcoded-output',
      files: ['wrongs/hardcoded-output.ino'],
      expectFailCategory: 'serial-value',
      description: 'Prints a fixed AVG=512; fails when the injected input changes.',
    },
    {
      id: 'sum-not-divided',
      files: ['wrongs/sum-not-divided.ino'],
      expectFailCategory: 'serial-value',
      description: 'Prints the sum of eight samples instead of the mean (~8x too large).',
    },
    {
      id: 'no-warmup',
      files: ['wrongs/no-warmup.ino'],
      expectFailCategory: 'serial-format',
      description: 'Prints from the first sample instead of waiting for eight — emits AVG too early.',
    },
  ],
  variants: [
    {
      id: 'steady-mid',
      description: '2.5 V → reading ~512 → AVG ~512.',
      budgetMs: RUN_MS,
      stimulus: [{ kind: 'adc', tMs: 0, channel: 0, volts: 2.5 }],
      contract: avgContract(readingForVolts(2.5)),
    },
    {
      id: 'steady-low',
      description: '0.3 V → reading ~61 (low boundary).',
      budgetMs: RUN_MS,
      stimulus: [{ kind: 'adc', tMs: 0, channel: 0, volts: 0.3 }],
      contract: avgContract(readingForVolts(0.3)),
    },
    {
      id: 'steady-high',
      description: '4.5 V → reading ~921 (high boundary).',
      budgetMs: RUN_MS,
      stimulus: [{ kind: 'adc', tMs: 0, channel: 0, volts: 4.5 }],
      contract: avgContract(readingForVolts(4.5)),
    },
    {
      id: 'changing-input',
      description: 'Steps 1.0 V → 4.0 V; after eight samples at the new level the AVG must track it.',
      budgetMs: 900,
      stimulus: [
        { kind: 'adc', tMs: 0, channel: 0, volts: 1.0 },
        { kind: 'adc', tMs: 300, channel: 0, volts: 4.0 },
      ],
      contract: avgContract(readingForVolts(4.0)),
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  // Base contract (bare runner, A0 at 0 V → reading 0): steady AVG=0.
  contract: avgContract(0),
};

export default task;
