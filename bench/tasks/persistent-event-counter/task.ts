import { buildProject } from '../../scenarios/persistent-event-counter/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { serialMatches, serialValue, eepromWriteCount, serialAbsent } from '../../contracts/dsl';
import type { StimulusEvent } from '../../harness/stimulus';
import type { OneShotScenario } from '../types';

// OS-D3-05. Persistent button-press counter in EEPROM + serial COUNT=n lines.
// Graded on serial value/format (§6c), persistence across simulated reset,
// 16-bit rollover (eepromSeed at 65535), and redundant-write rejection
// (eepromWriteCount after reset when data is already valid).
const SCENARIO_DIR = new URL('../../scenarios/persistent-event-counter/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const BAUD = 115200;
const RUN_MS = 2500;
const COUNT_PATTERN = /COUNT=(\d+)/;
const COUNT_FORMAT = /COUNT=\d+\r?\n/;

const RELEASED: StimulusEvent = { kind: 'pin', tMs: 0, pin: 2, level: 1 };
const press = (tMs: number): StimulusEvent[] => [
  { kind: 'pin', tMs, pin: 2, level: 0 },
  { kind: 'pin', tMs: tMs + 100, pin: 2, level: 1 },
];
const cmd = (tMs: number, data: string): StimulusEvent => ({ kind: 'serial', tMs, data, baud: BAUD });

const validSeed3: StimulusEvent = {
  kind: 'eepromSeed',
  tMs: 0,
  bytes: [
    { addr: 0, value: 3 },
    { addr: 1, value: 0 },
    { addr: 2, value: 0xa5 },
  ],
};

const seed65535: StimulusEvent = {
  kind: 'eepromSeed',
  tMs: 0,
  bytes: [
    { addr: 0, value: 0xff },
    { addr: 1, value: 0xff },
    { addr: 2, value: 0xa5 },
  ],
};

function countContract(expected: number) {
  return [
    ...serialValue({
      pattern: COUNT_PATTERN,
      expected,
      tolerance: 0,
      formatRegex: COUNT_FORMAT,
    }),
  ];
}

export const task: OneShotScenario = {
  id: 'persistent-event-counter',
  difficulty: 'D3',
  domain: 'persistence/state',
  tiers: ['B', 'C'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno that keeps a persistent button-press count in EEPROM.\n\n' +
    'A pushbutton from digital pin 2 to ground uses INPUT_PULLUP and a 30 ms debounce interval. Open Serial at 115200 baud. ' +
    'Store a 16-bit unsigned count plus a validity marker in EEPROM. If the marker is absent on first boot, initialize the count to 0. ' +
    'On every boot, print the restored value exactly as COUNT=n.\n\n' +
    'For each accepted button press, increment the count once, persist it, and print COUNT=n; holding the button must not repeat. ' +
    'The count wraps from 65535 to 0. The exact command CLEAR sets the count to 0, persists it, and prints COUNT=0; any other non-empty line prints ERR. ' +
    'The count must survive a reset, and the sketch must not write EEPROM when the stored value has not changed.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core plus its bundled EEPROM library.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'always-writes',
      files: ['wrongs/always-writes.ino'],
      expectFailCategory: 'eeprom-write',
      description: 'Calls EEPROM.write on every boot even when the stored count is unchanged.',
    },
    {
      id: 'no-debounce',
      files: ['wrongs/no-debounce.ino'],
      expectFailCategory: 'serial-format',
      description: 'No debounce — a held button emits COUNT=2 (fails hold-no-repeat).',
    },
    {
      id: 'no-wrap',
      files: ['wrongs/no-wrap.ino'],
      expectFailCategory: 'serial-value',
      description: 'Saturates at 65535 instead of wrapping to 0.',
    },
  ],
  variants: [
    {
      id: 'boot-and-press',
      description: 'Fresh boot prints COUNT=0; one debounced press → COUNT=1.',
      budgetMs: RUN_MS,
      stimulus: [RELEASED, ...press(400)],
      contract: [
        serialMatches(/COUNT=0\r?\n/),
        ...countContract(1),
      ],
    },
    {
      id: 'persist-across-reset',
      description: 'Increment once, simulated reset, boot line still COUNT=1.',
      budgetMs: RUN_MS,
      stimulus: [RELEASED, ...press(400), { kind: 'reset', tMs: 1500 }],
      contract: [
        serialMatches(/COUNT=1\r?\n/, { window: { fromMs: 350, toMs: 1400 } }),
        serialMatches(/COUNT=1\r?\n/, { window: { fromMs: 1500, toMs: RUN_MS } }),
      ],
    },
    {
      id: 'rollover',
      description: 'Pre-seed count=65535; one press wraps to COUNT=0.',
      budgetMs: RUN_MS,
      stimulus: [RELEASED, seed65535, ...press(500)],
      contract: [
        serialMatches(/COUNT=65535\r?\n/),
        ...countContract(0),
      ],
    },
    {
      id: 'clear-and-err',
      description: 'CLEAR → 0; garbage line → ERR; press → 1.',
      budgetMs: RUN_MS,
      stimulus: [RELEASED, cmd(300, 'CLEAR\n'), cmd(600, 'FOO\n'), ...press(900)],
      contract: [
        serialMatches(/COUNT=0\r?\n/),
        serialMatches(/ERR\r?\n/),
        serialMatches(/COUNT=1\r?\n/, { window: { fromMs: 900, toMs: RUN_MS } }),
      ],
    },
    {
      id: 'hold-no-repeat',
      description: 'Long press must not emit COUNT=2 (debounce discriminator).',
      budgetMs: RUN_MS,
      stimulus: [
        RELEASED,
        { kind: 'pin', tMs: 400, pin: 2, level: 0 },
        { kind: 'pin', tMs: 900, pin: 2, level: 1 },
      ],
      contract: [
        serialMatches(/COUNT=1\r?\n/),
        serialAbsent(/COUNT=2\r?\n/),
      ],
    },
    {
      id: 'no-redundant-write',
      description: 'Valid EEPROM pre-seed; after reset boot must not write EEPROM.',
      budgetMs: 2000,
      stimulus: [RELEASED, validSeed3, { kind: 'reset', tMs: 1000 }],
      contract: [
        serialMatches(/COUNT=3\r?\n/, { window: { fromMs: 0, toMs: 900 } }),
        serialMatches(/COUNT=3\r?\n/, { window: { fromMs: 1000, toMs: 1900 } }),
        eepromWriteCount({ max: 0, window: { fromMs: 1000, toMs: 1900 } }),
      ],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  contract: [serialMatches(/COUNT=0\r?\n/, { withinMs: 500 })],
};

export default task;
