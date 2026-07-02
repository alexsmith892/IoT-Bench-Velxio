import { buildProject } from '../../scenarios/zone-climate-controller/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { serialMatches, pinState, adcDerivedValue } from '../../contracts/dsl';
import type { StimulusEvent } from '../../harness/stimulus';
import type { OneShotScenario } from '../types';

// OS-D4-05. Two-zone TMP36 climate control + fault interlock + serial SET/STATUS.
// Active-low heaters: pin LOW = on. Graded on pin-state (heaters + fault response),
// serial format, and decoded STATUS fields (multi-contract partial credit).
const SCENARIO_DIR = new URL('../../scenarios/zone-climate-controller/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const BAUD = 115200;
const RUN_MS = 3500;
const voltsForTempC = (c: number) => 0.5 + c * 0.01;
const faultReleased: StimulusEvent = { kind: 'pin', tMs: 0, pin: 2, level: 1 };
const faultActive = (tMs: number): StimulusEvent => ({ kind: 'pin', tMs, pin: 2, level: 0 });
const cmd = (tMs: number, data: string): StimulusEvent => ({ kind: 'serial', tMs, data, baud: BAUD });

export const task: OneShotScenario = {
  id: 'zone-climate-controller',
  difficulty: 'D4',
  domain: 'integrated',
  tiers: ['A', 'B'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno implementing a two-zone climate controller with serial configuration and a global safety interlock. There is no display.\n\n' +
    'Hardware:\n' +
    '- Zone 1 TMP36 on A0; Zone 2 TMP36 on A1. Both use a 5.0 V ADC reference, 0.500 V offset, and 0.010 V/°C slope.\n' +
    '- Zone 1 active-low heater on digital pin 6; Zone 2 active-low heater on digital pin 7 (LOW = on, HIGH = off).\n' +
    '- A fault input on digital pin 2 with INPUT_PULLUP; LOW means fault active.\n\n' +
    'Each zone controls its heater independently with hysteresis: turn the heater on when that zone\'s temperature is at or below its setpoint minus 0.5 °C, off when at or above its setpoint plus 0.5 °C, and hold inside the band. Sample both zones every 100 ms. Both setpoints default to 21.0 °C, bounded to 10.0 through 30.0 °C. Both heaters must be off at startup until the first sample is processed.\n\n' +
    'While the fault input is active, force both heaters off within 50 ms and suspend control; when the fault clears, resume normal control. Open Serial at 115200 baud and accept LF- or CRLF-terminated commands:\n' +
    '- SET z v, where z is 1 or 2 and v is a setpoint in 10.0 through 30.0, updates that zone\'s setpoint and replies OK.\n' +
    '- STATUS replies exactly `Z1 T=a.a S=b.b H=ON|OFF Z2 T=c.c S=d.d H=ON|OFF FAULT=ON|OFF` using one decimal digit for temperatures and setpoints and the current state.\n' +
    '- A malformed or out-of-range command changes nothing and replies ERR.\n\n' +
    'Sampling, both control loops, fault handling, and serial parsing must run concurrently.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'blocking-delay',
      files: ['wrongs/blocking-delay.ino'],
      expectFailCategory: 'pin-state',
      description: 'delay(150) in loop — fault cannot turn heaters off within 50 ms.',
    },
    {
      id: 'hardcoded-setpoint',
      files: ['wrongs/hardcoded-setpoint.ino'],
      expectFailCategory: 'serial-format',
      description: 'STATUS always prints S=21.0 even after SET 1 25.0.',
    },
  ],
  variants: [
    {
      id: 'startup-off',
      description: 'Heaters stay off (HIGH) until the first 100 ms sample.',
      budgetMs: 80,
      stimulus: [
        faultReleased,
        { kind: 'adc', tMs: 0, channel: 0, volts: voltsForTempC(19.0) },
        { kind: 'adc', tMs: 0, channel: 1, volts: voltsForTempC(19.0) },
      ],
      contract: [
        pinState(6, 1, { window: { fromMs: 10, toMs: 75 } }),
        pinState(7, 1, { window: { fromMs: 10, toMs: 75 } }),
      ],
    },
    {
      id: 'dual-zone-control',
      description: 'Z1 cold → heater on; Z2 warm → heater off (independent hysteresis).',
      budgetMs: RUN_MS,
      stimulus: [
        faultReleased,
        { kind: 'adc', tMs: 0, channel: 0, volts: voltsForTempC(19.0) },
        { kind: 'adc', tMs: 0, channel: 1, volts: voltsForTempC(23.0) },
        cmd(600, 'STATUS\n'),
      ],
      contract: [
        pinState(6, 0, { window: { fromMs: 250, toMs: 2000 } }),
        pinState(7, 1, { window: { fromMs: 250, toMs: 2000 } }),
        serialMatches(/H=ON Z2 T=2[23]\.\d S=21\.\d H=OFF FAULT=OFF\r?\n/, {
          window: { fromMs: 550, toMs: RUN_MS },
        }),
      ],
    },
    {
      id: 'fault-interlock',
      description: 'With heaters on, fault active → both off within ~80 ms.',
      budgetMs: RUN_MS,
      stimulus: [
        faultReleased,
        { kind: 'adc', tMs: 0, channel: 0, volts: voltsForTempC(18.0) },
        { kind: 'adc', tMs: 0, channel: 1, volts: voltsForTempC(18.0) },
        faultActive(800),
      ],
      contract: [
        pinState(6, 0, { window: { fromMs: 300, toMs: 750 } }),
        pinState(6, 1, { window: { fromMs: 820, toMs: 880 } }),
        pinState(7, 1, { window: { fromMs: 820, toMs: 1500 } }),
      ],
    },
    {
      id: 'set-and-status',
      description: 'SET 1 25.0 → OK; invalid SET → ERR; STATUS reflects new setpoint.',
      budgetMs: RUN_MS,
      stimulus: [
        faultReleased,
        { kind: 'adc', tMs: 0, channel: 0, volts: voltsForTempC(22.0) },
        { kind: 'adc', tMs: 0, channel: 1, volts: voltsForTempC(22.0) },
        cmd(400, 'SET 1 25.0\n'),
        cmd(800, 'SET 9 99.0\n'),
        cmd(1200, 'STATUS\n'),
      ],
      contract: [
        serialMatches(/OK\r?\n/),
        serialMatches(/ERR\r?\n/),
        serialMatches(/S=25\.0/),
        adcDerivedValue({
          pattern: /Z1 T=([\d.]+)/,
          expected: 22.0,
          tolerance: 0.6,
        }),
      ],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  contract: [
    pinState(6, 1, { window: { fromMs: 5, toMs: 90 } }),
    pinState(7, 1, { window: { fromMs: 5, toMs: 90 } }),
  ],
};

export default task;
