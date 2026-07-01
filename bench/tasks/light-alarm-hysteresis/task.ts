import { buildProject } from '../../scenarios/light-alarm-hysteresis/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { pinState } from '../../contracts/dsl';
import type { OneShotScenario } from '../types';

// OS-D2-03. Light ADC on A2 → active-high warning LED on D6 with hysteresis: on at
// reading <=350, off at >=450, HOLD in the 350..450 band. The harness injects the
// A2 voltage and grades the driven D6 level (category `pin-state`). This task has
// NO concurrent behaviour, so a blocking (delay-based) solution is valid. The
// `hysteresis-hold` variant is the discriminator: it enters the band from BOTH
// directions so a single-threshold solution flips where the reference holds.
const SCENARIO_DIR = new URL('../../scenarios/light-alarm-hysteresis/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const RUN_MS = 1200;
/** Volts that make analogRead(A2) return `reading` (ADC 0..1023 over 0..5 V). */
const voltsForReading = (reading: number) => (reading * 5) / 1023;

export const task: OneShotScenario = {
  id: 'light-alarm-hysteresis',
  difficulty: 'D2',
  domain: 'analog/state',
  tiers: ['A'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno. A light sensor produces an ADC reading ' +
    'on A2. An active-high warning LED is on digital pin 6.\n\n' +
    'Sample at least once every 20 ms. Turn the LED on when the reading is 350 or lower, off when ' +
    'it is 450 or higher, and retain the previous state for readings strictly between 350 and 450. ' +
    'The LED starts off.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its ' +
    'bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'single-threshold',
      files: ['wrongs/single-threshold.ino'],
      expectFailCategory: 'pin-state',
      description: 'One threshold at 400, no hold band — flips inside the 350..450 band.',
    },
    {
      id: 'inverted-polarity',
      files: ['wrongs/inverted-polarity.ino'],
      expectFailCategory: 'pin-state',
      description: 'Alarms on bright instead of dark.',
    },
  ],
  variants: [
    {
      id: 'below-threshold',
      description: 'Reading 345 (≤350) → on; 455 (≥450) → off (both thresholds).',
      budgetMs: 800,
      stimulus: [
        { kind: 'adc', tMs: 0, channel: 2, volts: voltsForReading(345) },
        { kind: 'adc', tMs: 400, channel: 2, volts: voltsForReading(455) },
      ],
      contract: [
        pinState(6, 1, { window: { fromMs: 100, toMs: 380 } }), // dark → on
        pinState(6, 0, { window: { fromMs: 500, toMs: 780 } }), // bright → off
      ],
    },
    {
      id: 'hysteresis-hold',
      description:
        'Enter the band from both sides: from OFF (reading 500) into band (380) must HOLD off; ' +
        'from ON (reading 300) into band (400) must HOLD on. A single-threshold solution flips.',
      budgetMs: RUN_MS,
      stimulus: [
        { kind: 'adc', tMs: 0, channel: 2, volts: voltsForReading(500) }, // off region
        { kind: 'adc', tMs: 300, channel: 2, volts: voltsForReading(380) }, // band → hold off
        { kind: 'adc', tMs: 600, channel: 2, volts: voltsForReading(300) }, // dark → on
        { kind: 'adc', tMs: 900, channel: 2, volts: voltsForReading(400) }, // band → hold on
      ],
      contract: [
        pinState(6, 0, { window: { fromMs: 150, toMs: 290 } }), // off region
        pinState(6, 0, { window: { fromMs: 450, toMs: 590 } }), // band from off → still off
        pinState(6, 1, { window: { fromMs: 750, toMs: 890 } }), // dark → on
        pinState(6, 1, { window: { fromMs: 1050, toMs: 1180 } }), // band from on → still on
      ],
    },
    {
      id: 'repeat-cycles',
      description: 'Dark/bright cycles — the alarm tracks each crossing (repeat theme).',
      budgetMs: RUN_MS,
      stimulus: [
        { kind: 'adc', tMs: 0, channel: 2, volts: voltsForReading(300) },
        { kind: 'adc', tMs: 300, channel: 2, volts: voltsForReading(500) },
        { kind: 'adc', tMs: 600, channel: 2, volts: voltsForReading(300) },
        { kind: 'adc', tMs: 900, channel: 2, volts: voltsForReading(500) },
      ],
      contract: [
        pinState(6, 1, { window: { fromMs: 80, toMs: 280 } }),
        pinState(6, 0, { window: { fromMs: 380, toMs: 580 } }),
        pinState(6, 1, { window: { fromMs: 680, toMs: 880 } }),
        pinState(6, 0, { window: { fromMs: 980, toMs: 1180 } }),
      ],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  // Base contract (bare runner, A2 at 0 V → reading 0 ≤ 350): the alarm turns on.
  contract: [pinState(6, 1, { window: { fromMs: 100, toMs: RUN_MS } })],
};

export default task;
