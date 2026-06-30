import { buildProject } from '../../scenarios/potentiometer-pwm-map/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { pwmDuty } from '../../contracts/dsl';
import type { OneShotScenario } from '../types';

// OS-D1-04. Pot on A1 → PWM duty on D3, ADC 0..1023 mapped to duty 0..255. The
// harness injects the A1 voltage and grades the steady-state D3 duty (category
// `pwm-duty`). Expected duty ≈ volts/5; the default ±0.05 absolute tolerance
// (policy.pwmDutyPct) absorbs the 8-bit map quantization. The `mid-scale` variant
// is the proportional-vs-threshold discriminator.
const SCENARIO_DIR = new URL('../../scenarios/potentiometer-pwm-map/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const RUN_MS = 600;
/** Expected steady-state duty for an injected A1 voltage (duty ≈ volts/5). */
const dutyForVolts = (volts: number) => volts / 5;

export const task: OneShotScenario = {
  id: 'potentiometer-pwm-map',
  difficulty: 'D1',
  domain: 'analog/PWM',
  tiers: ['A'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno. A potentiometer is on A1 and an LED is ' +
    'on PWM-capable digital pin 3.\n\n' +
    'At least once every 20 ms, read A1 and set the LED’s PWM duty by linearly mapping ADC 0 ' +
    'to duty 0 and ADC 1023 to duty 255, clamped to 0 through 255. Intermediate readings must ' +
    'produce the corresponding intermediate duty.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its ' +
    'bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'digital-threshold',
      files: ['wrongs/digital-threshold.ino'],
      expectFailCategory: 'pwm-duty',
      description: 'On/off threshold instead of proportional duty.',
    },
    {
      id: 'fixed-duty',
      files: ['wrongs/fixed-duty.ino'],
      expectFailCategory: 'pwm-duty',
      description: 'Hardcoded half-brightness, ignores the pot.',
    },
  ],
  variants: [
    {
      id: 'mid-scale',
      description: '2.5 V → duty ~0.5 — kills an on/off threshold solution.',
      budgetMs: RUN_MS,
      stimulus: [{ kind: 'adc', tMs: 0, channel: 1, volts: 2.5 }],
      contract: [pwmDuty(3, { duty: dutyForVolts(2.5) })],
    },
    {
      id: 'low-boundary',
      description: '0 V → duty 0 (LED fully off).',
      budgetMs: RUN_MS,
      stimulus: [{ kind: 'adc', tMs: 0, channel: 1, volts: 0 }],
      contract: [pwmDuty(3, { duty: 0 })],
    },
    {
      id: 'high-boundary',
      description: '5 V → duty 1 (LED fully on).',
      budgetMs: RUN_MS,
      stimulus: [{ kind: 'adc', tMs: 0, channel: 1, volts: 5 }],
      contract: [pwmDuty(3, { duty: 1 })],
    },
    {
      id: 'changing-input',
      description: 'Steps 1.0 V → 4.0 V mid-run; the duty must track to ~0.8.',
      budgetMs: 900,
      stimulus: [
        { kind: 'adc', tMs: 0, channel: 1, volts: 1.0 },
        { kind: 'adc', tMs: 400, channel: 1, volts: 4.0 },
      ],
      contract: [pwmDuty(3, { duty: dutyForVolts(4.0) })],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  // Base contract (bare runner, no stimulus → A1 at 0 V): duty rests at 0.
  contract: [pwmDuty(3, { duty: 0 })],
};

export default task;
