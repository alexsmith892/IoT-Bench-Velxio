import { buildProject } from '../../scenarios/water-tank-controller/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import {
  serialMatches,
  pinState,
  eepromWriteCount,
  maxFlashBytes,
  maxRamBytes,
} from '../../contracts/dsl';
import type { StimulusEvent } from '../../harness/stimulus';
import type { OneShotScenario } from '../types';

// OS-D4-04. Water tank: ADC level, pump (D7 active-low), alarm (D6), silence button,
// EEPROM thresholds, serial SET/STATUS. Multi-contract partial credit.
const SCENARIO_DIR = new URL('../../scenarios/water-tank-controller/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const BAUD = 115200;
const RUN_MS = 4000;
const voltsForLevel = (reading: number) => (reading * 5) / 1023;
const RELEASED: StimulusEvent = { kind: 'pin', tMs: 0, pin: 2, level: 1 };
const press = (tMs: number): StimulusEvent[] => [
  { kind: 'pin', tMs, pin: 2, level: 0 },
  { kind: 'pin', tMs: tMs + 80, pin: 2, level: 1 },
];
const cmd = (tMs: number, data: string): StimulusEvent => ({ kind: 'serial', tMs, data, baud: BAUD });

const seedThresholds = (low: number, high: number): StimulusEvent => ({
  kind: 'eepromSeed',
  tMs: 0,
  bytes: [
    { addr: 0, value: low & 0xff },
    { addr: 1, value: low >> 8 },
    { addr: 2, value: high & 0xff },
    { addr: 3, value: high >> 8 },
    { addr: 4, value: 0xa5 },
  ],
});

export const task: OneShotScenario = {
  id: 'water-tank-controller',
  difficulty: 'D4',
  domain: 'integrated/persistence',
  tiers: ['B', 'C'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno implementing a persistent water-tank controller.\n\n' +
    'Hardware:\n' +
    '- Analog level sensor on A0, producing readings from 0 (empty) through 1023 (full).\n' +
    '- Active-low pump output on digital pin 7.\n' +
    '- Active-high overflow alarm on digital pin 6.\n' +
    '- Alarm-silence button on digital pin 2, wired to ground with INPUT_PULLUP and a 30 ms debounce interval.\n\n' +
    'Open Serial at 115200 baud. Default thresholds are LOW=300 and HIGH=700. Persist both thresholds plus a validity marker in EEPROM and restore them after reset. If no valid saved settings exist, use and save the defaults. Sample level every 50 ms. Turn the pump on at or below LOW and keep it on until the level reaches or exceeds HIGH. Turn the overflow alarm on at level 900 or above. An accepted silence-button press turns the alarm off for the current high-level episode; silencing resets only after level falls below 850. The pump must be off during startup until the first sample is processed.\n\n' +
    'Accept LF- or CRLF-terminated commands:\n' +
    '- SET LOW n\n' +
    '- SET HIGH n\n' +
    '- STATUS\n\n' +
    'Values must satisfy 0 <= LOW < HIGH <= 1023. A valid SET updates and persists the setting and replies OK. An invalid or malformed command changes nothing and replies ERR. STATUS replies exactly `LEVEL=n LOW=n HIGH=n PUMP=ON|OFF ALARM=ON|OFF` using current state. Sampling, control, button handling, and serial parsing must run concurrently, and the sketch must not write EEPROM when a value has not changed.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core plus its bundled EEPROM library.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'blocking-loop',
      files: ['wrongs/blocking-loop.ino'],
      expectFailCategory: 'pin-state',
      description: 'delay(100) in loop — pump cannot track a fast level ramp.',
    },
    {
      id: 'always-writes-eeprom',
      files: ['wrongs/always-writes-eeprom.ino'],
      expectFailCategory: 'eeprom-write',
      description: 'Rewrites EEPROM on every boot even when thresholds are unchanged.',
    },
  ],
  variants: [
    {
      id: 'fill-cycle',
      description: 'Level ramp low→high: pump on at ≤LOW, off at ≥HIGH.',
      budgetMs: RUN_MS,
      stimulus: [
        RELEASED,
        { kind: 'adc', tMs: 0, channel: 0, volts: voltsForLevel(250) },
        { kind: 'adc', tMs: 600, channel: 0, volts: voltsForLevel(750) },
      ],
      contract: [
        pinState(7, 1, { window: { fromMs: 5, toMs: 45 } }), // pump off before first sample
        pinState(7, 0, { window: { fromMs: 150, toMs: 550 } }), // pump on (active-low)
        pinState(7, 1, { window: { fromMs: 750, toMs: RUN_MS } }), // pump off
      ],
    },
    {
      id: 'overflow-silence',
      description: 'Level ≥900 alarm on; silence button off; re-arms after level drops then rises.',
      budgetMs: RUN_MS,
      stimulus: [
        RELEASED,
        { kind: 'adc', tMs: 0, channel: 0, volts: voltsForLevel(950) },
        ...press(700),
        { kind: 'adc', tMs: 1500, channel: 0, volts: voltsForLevel(800) },
        { kind: 'adc', tMs: 2200, channel: 0, volts: voltsForLevel(950) },
      ],
      contract: [
        pinState(6, 1, { window: { fromMs: 150, toMs: 650 } }),
        pinState(6, 0, { window: { fromMs: 800, toMs: 1200 } }),
        pinState(6, 1, { window: { fromMs: 2400, toMs: RUN_MS } }),
      ],
    },
    {
      id: 'set-and-status',
      description: 'Valid SET LOW/HIGH, invalid SET, STATUS reflects state.',
      budgetMs: RUN_MS,
      stimulus: [
        RELEASED,
        { kind: 'adc', tMs: 0, channel: 0, volts: voltsForLevel(180) },
        cmd(300, 'SET LOW 200\n'),
        cmd(500, 'SET HIGH 800\n'),
        cmd(700, 'SET LOW 900\n'),
        cmd(900, 'STATUS\n'),
      ],
      contract: [
        serialMatches(/OK\r?\n/, { window: { fromMs: 350, toMs: 550 } }),
        serialMatches(/ERR\r?\n/, { window: { fromMs: 700, toMs: 850 } }),
        serialMatches(/LOW=200 HIGH=800 PUMP=ON ALARM=OFF\r?\n/, {
          window: { fromMs: 900, toMs: RUN_MS },
        }),
      ],
    },
    {
      id: 'persist-thresholds',
      description: 'Custom thresholds survive simulated reset.',
      budgetMs: RUN_MS,
      stimulus: [
        RELEASED,
        seedThresholds(200, 800),
        { kind: 'adc', tMs: 0, channel: 0, volts: voltsForLevel(400) },
        { kind: 'reset', tMs: 1200 },
        cmd(1400, 'STATUS\n'),
      ],
      contract: [
        serialMatches(/LOW=200 HIGH=800/, { window: { fromMs: 1400, toMs: RUN_MS } }),
      ],
    },
    {
      id: 'no-redundant-write',
      description: 'Valid EEPROM seed; second boot after reset writes nothing.',
      budgetMs: 2000,
      stimulus: [RELEASED, seedThresholds(300, 700), { kind: 'reset', tMs: 800 }],
      contract: [
        eepromWriteCount({ max: 0, window: { fromMs: 805, toMs: 1900 } }),
      ],
    },
    {
      id: 'near-budget',
      description: 'D4 tier compile-size diagnostic (§7).',
      budgetMs: 500,
      stimulus: [RELEASED, { kind: 'adc', tMs: 0, channel: 0, volts: voltsForLevel(500) }],
      contract: [maxFlashBytes(8192), maxRamBytes(512)],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  contract: [pinState(7, 1, { window: { fromMs: 5, toMs: 80 } })],
};

export default task;
