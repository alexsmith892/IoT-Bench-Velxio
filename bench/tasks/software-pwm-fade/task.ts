import { buildProject } from '../../scenarios/software-pwm-fade/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { pinFrequency, pinDutyCycle } from '../../contracts/assertions';
import { serialMatches, serialAbsent, pinState } from '../../contracts/dsl';
import type { OneShotScenario } from '../types';

// OS-D3-09. Hand-rolled 200 Hz (5 ms) software PWM on D8 (a non-PWM pin) — no
// analogWrite/timer PWM. Serial "DUTY n" sets duty immediately; "RAMP n ms" moves
// the duty linearly then holds; malformed/out-of-range → ERR. Graded on the D8
// carrier `frequency` (kills an analogWrite solution — D8 can't hardware-PWM) and
// windowed `duty` (kills an instant-ramp), plus the literal replies.
const SCENARIO_DIR = new URL('../../scenarios/software-pwm-fade/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const RUN_MS = 2000;
const duty = (n: number) => n / 255;
const cmd = (tMs: number, data: string) => ({ kind: 'serial' as const, tMs, data });

export const task: OneShotScenario = {
  id: 'software-pwm-fade',
  difficulty: 'D3',
  domain: 'timing/actuator',
  tiers: ['B'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno that generates a software PWM signal on ' +
    'digital pin 8, a pin with no hardware PWM. Do not use analogWrite(), the hardware timers\' PWM ' +
    'output modes, or the Servo library; generate the waveform yourself from timing in your own ' +
    'code.\n\n' +
    'The carrier must run at 200 Hz, i.e. a 5 ms period. Duty is an 8-bit value 0 through 255: 0 ' +
    'holds the pin LOW for the whole period, 255 holds it HIGH for the whole period, and an ' +
    'intermediate value drives the pin HIGH for that fraction of each period and LOW for the ' +
    'remainder. The output starts at duty 0.\n\n' +
    'Open Serial at 115200 baud and accept LF- or CRLF-terminated commands:\n' +
    '- DUTY n, for decimal n from 0 through 255, sets the duty immediately and replies OK DUTY=n.\n' +
    '- RAMP n ms, for duty n (0..255) and ms (1..10000), linearly moves the duty from its current ' +
    'value to n over the given number of milliseconds, then holds; reply OK RAMP=n.\n' +
    '- A malformed command or out-of-range value changes nothing and replies ERR.\n\n' +
    'The carrier must keep running and serial must stay responsive while a ramp is in progress.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its ' +
    'bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'analogwrite-8',
      files: ['wrongs/analogwrite-8.ino'],
      expectFailCategory: 'frequency',
      description: 'Uses analogWrite() on D8, which has no hardware PWM — the pin never toggles at 200 Hz.',
    },
    {
      id: 'instant-ramp',
      files: ['wrongs/instant-ramp.ino'],
      expectFailCategory: 'duty',
      description: 'RAMP jumps to the target duty immediately instead of moving linearly over the time.',
    },
  ],
  variants: [
    {
      id: 'set-mid',
      description: 'DUTY 128 → ~50% duty at 200 Hz.',
      budgetMs: RUN_MS,
      stimulus: [cmd(100, 'DUTY 128\n')],
      contract: [
        pinFrequency(8, { hz: 200, window: { fromMs: 300, toMs: 1900 } }),
        pinDutyCycle(8, { duty: duty(128), window: { fromMs: 300, toMs: 1900 } }),
        serialMatches(/OK DUTY=128\r?\n/),
      ],
    },
    {
      id: 'boundaries',
      description: 'DUTY 255 → held HIGH, then DUTY 0 → held LOW (the non-toggling extremes).',
      budgetMs: RUN_MS,
      stimulus: [cmd(100, 'DUTY 255\n'), cmd(1100, 'DUTY 0\n')],
      contract: [
        pinState(8, 1, { window: { fromMs: 300, toMs: 1000 } }),  // full HIGH
        pinState(8, 0, { window: { fromMs: 1300, toMs: 1900 } }), // full LOW
        serialMatches(/OK DUTY=255\r?\n/),
        serialMatches(/OK DUTY=0\r?\n/),
      ],
    },
    {
      id: 'ramp',
      description: 'RAMP 200 800 → duty rises 0→200 over 800 ms; mid-ramp must be intermediate, not instant.',
      budgetMs: RUN_MS,
      stimulus: [cmd(100, 'RAMP 200 800\n')],
      contract: [
        pinFrequency(8, { hz: 200, window: { fromMs: 450, toMs: 550 } }), // carrier keeps running mid-ramp
        pinDutyCycle(8, { duty: duty(100), tolPct: 12, window: { fromMs: 450, toMs: 550 } }), // ~39% mid-ramp (kills instant-ramp)
        pinDutyCycle(8, { duty: duty(200), window: { fromMs: 1200, toMs: 1900 } }), // settled at target
        serialMatches(/OK RAMP=200\r?\n/),
      ],
    },
    {
      id: 'invalid',
      description: 'DUTY 100 valid, then out-of-range / bad-ms / non-decimal → ERR and no change.',
      budgetMs: RUN_MS,
      stimulus: [
        cmd(100, 'DUTY 100\n'),
        cmd(800, 'DUTY 300\n'),       // out of range → ERR
        cmd(1000, 'RAMP 50 20000\n'), // ms out of range → ERR
        cmd(1200, 'DUTY abc\n'),      // non-decimal → ERR
      ],
      contract: [
        pinDutyCycle(8, { duty: duty(100), window: { fromMs: 1400, toMs: 1900 } }), // unchanged by invalids
        serialMatches(/OK DUTY=100\r?\n/),
        serialMatches(/ERR\r?\n/),
      ],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  // Base contract (bare runner, no command): duty 0 → pin held LOW, no reply.
  contract: [
    pinState(8, 0, { window: { fromMs: 50, toMs: RUN_MS } }),
    serialAbsent(/OK|ERR/),
  ],
};

export default task;
