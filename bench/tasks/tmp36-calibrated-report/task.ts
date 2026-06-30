import { buildProject } from '../../scenarios/tmp36-calibrated-report/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { serialValue, serialMatches, maxFlashBytes, maxRamBytes } from '../../contracts/dsl';
import type { Contract } from '../../contracts/types';
import type { OneShotScenario } from '../types';

// OS-D1-03. TMP36 on A0 → `TEMP_C=x.x` over serial. The harness injects the A0
// voltage directly and grades the DECODED value (semantic) separately from the
// literal format (§6c), so a hardcoded string fails as soon as the injected
// voltage changes. Also carries the tier's near-budget compile-size variant (§7).
const SCENARIO_DIR = new URL('../../scenarios/tmp36-calibrated-report/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const RUN_MS = 1200;
// Tolerance covers ADC quantization (~0.25 °C/LSB at 5 V/1024) + the one-decimal
// print rounding (±0.05) with margin. A wrong formula/offset is off by whole
// degrees, so 0.5 still discriminates.
const TEMP_TOL = 0.5;
const TEMP_PATTERN = /TEMP_C=(-?\d+\.\d)/;
const TEMP_FORMAT = /TEMP_C=-?\d+\.\d\r?\n/;

/** TMP36 transfer: °C = (volts − 0.5) / 0.01. */
const tempForVolts = (volts: number) => (volts - 0.5) / 0.01;

/** The value/format split plus the first-line-within-300 ms format check. */
function reportContract(expectedC: number): Contract {
  return [
    ...serialValue({
      pattern: TEMP_PATTERN,
      expected: expectedC,
      tolerance: TEMP_TOL,
      formatRegex: TEMP_FORMAT,
    }),
    serialMatches(/TEMP_C=/, { withinMs: 300 }), // first line appears within 300 ms
  ];
}

export const task: OneShotScenario = {
  id: 'tmp36-calibrated-report',
  difficulty: 'D1',
  domain: 'analog/numeric',
  tiers: ['A'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno that reads a TMP36 temperature sensor ' +
    'on A0.\n\n' +
    'The ADC reference is 5.0 V and the ADC result ranges 0 through 1023. The TMP36 outputs ' +
    '0.500 V at 0 °C and changes by 0.010 V per °C. Convert each reading to degrees Celsius.\n\n' +
    'Open Serial at 115200 baud and print one reading every 250 ms in exactly this form, with one ' +
    'digit after the decimal point and a newline:\n' +
    'TEMP_C=23.4\n\n' +
    'The first line must appear within 300 ms of startup.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its ' +
    'bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'hardcoded-output',
      files: ['wrongs/hardcoded-output.ino'],
      expectFailCategory: 'serial-value',
      description: 'Hardcodes TEMP_C=23.4; fails when the injected voltage changes.',
    },
    {
      id: 'missing-offset',
      files: ['wrongs/missing-offset.ino'],
      expectFailCategory: 'serial-value',
      description: 'Omits the 0.5 V offset — every reading off by 50 °C.',
    },
  ],
  variants: [
    {
      id: 'room-temp',
      description: '0.734 V → 23.4 °C (the worked example).',
      budgetMs: RUN_MS,
      stimulus: [{ kind: 'adc', tMs: 0, channel: 0, volts: 0.734 }],
      contract: reportContract(tempForVolts(0.734)),
    },
    {
      id: 'zero-boundary',
      description: '0.5 V → 0.0 °C (offset boundary).',
      budgetMs: RUN_MS,
      stimulus: [{ kind: 'adc', tMs: 0, channel: 0, volts: 0.5 }],
      contract: reportContract(tempForVolts(0.5)),
    },
    {
      id: 'negative-temp',
      description: '0.3 V → -20.0 °C (sign handling + format).',
      budgetMs: RUN_MS,
      stimulus: [{ kind: 'adc', tMs: 0, channel: 0, volts: 0.3 }],
      contract: reportContract(tempForVolts(0.3)),
    },
    {
      id: 'changing-input',
      description: 'Steps 0.734 V → 1.0 V mid-run; the last report must track to 50 °C.',
      budgetMs: 1300,
      stimulus: [
        { kind: 'adc', tMs: 0, channel: 0, volts: 0.734 },
        { kind: 'adc', tMs: 600, channel: 0, volts: 1.0 },
      ],
      contract: reportContract(tempForVolts(1.0)),
    },
    {
      id: 'near-budget',
      description: 'Tier compile-size diagnostic — must fit an ATtiny85-tight budget (§7).',
      budgetMs: RUN_MS,
      stimulus: [{ kind: 'adc', tMs: 0, channel: 0, volts: 0.734 }],
      contract: [
        ...reportContract(tempForVolts(0.734)),
        maxFlashBytes(8192), // ATtiny85 flash
        maxRamBytes(512), // ATtiny85 SRAM
      ],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  // Base contract (bare runner, no stimulus → A0 at 0 V ≈ -50 °C): just grade the
  // output FORMAT and cadence, since the value is whatever the floor voltage gives.
  contract: [serialMatches(TEMP_FORMAT, { everyMs: 250 })],
};

export default task;
