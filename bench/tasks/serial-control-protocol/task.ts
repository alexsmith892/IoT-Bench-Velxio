import { buildProject } from '../../scenarios/serial-control-protocol/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { serialMatches, serialAbsent, pinState, pwmDuty } from '../../contracts/dsl';
import type { OneShotScenario } from '../types';

// OS-D2-07. Line-oriented serial control protocol @115200: LED ON/OFF (D7), PWM n
// (D3), STATUS; case-insensitive words, trimmed spaces, persistent state; ERR for
// malformed/out-of-range; overlong-line recovery. Graded on the physical effect
// (D7 `pin-state`, D3 `pwm-duty` — the semantic half) plus the literal replies
// (`serial-format`). The `case-and-spaces` variant kills a case-sensitive parser;
// `error-handling` kills a parser that skips the PWM range check; `overlong-recovery`
// exercises the discard-to-terminator path (Pass-8 success criterion).
const SCENARIO_DIR = new URL('../../scenarios/serial-control-protocol/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const RUN_MS = 1000;
const duty = (n: number) => n / 255;

export const task: OneShotScenario = {
  id: 'serial-control-protocol',
  difficulty: 'D2',
  domain: 'serial-protocol',
  tiers: ['B'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno implementing a line-oriented serial ' +
    'control protocol at 115200 baud.\n\n' +
    'An active-high LED is on digital pin 7 and a PWM output is on digital pin 3; both start at 0. ' +
    'Commands are ASCII, terminated by LF or CRLF. Ignore leading and trailing spaces, treat ' +
    'command words case-insensitively, and process commands arriving over time without resetting ' +
    'state.\n\n' +
    'Commands and exact responses:\n' +
    '- LED ON  -> set pin 7 HIGH, reply OK LED=ON\n' +
    '- LED OFF -> set pin 7 LOW, reply OK LED=OFF\n' +
    '- PWM n   -> for decimal n from 0 through 255, set pin 3 to n, reply OK PWM=n\n' +
    '- STATUS  -> reply STATUS LED=ON PWM=n or STATUS LED=OFF PWM=n from current state\n\n' +
    'For a malformed command, unknown command, missing argument, non-decimal PWM value, or PWM ' +
    'value outside 0 through 255, change neither output and reply exactly ERR. End every response ' +
    'with a newline. After an overlong line, recover by discarding through its terminator, reply ' +
    'ERR once, and keep accepting later commands.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its ' +
    'bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'case-sensitive',
      files: ['wrongs/case-sensitive.ino'],
      expectFailCategory: 'pin-state',
      description: 'Matches command words case-sensitively; a lower-case "led on" never lights D7.',
    },
    {
      id: 'no-range-check',
      files: ['wrongs/no-range-check.ino'],
      expectFailCategory: 'pwm-duty',
      description: 'Accepts an out-of-range PWM value and writes the truncated byte instead of ERR.',
    },
  ],
  variants: [
    {
      id: 'basic-commands',
      description: 'LED ON, PWM 128, STATUS, LED OFF — replies and physical effects.',
      budgetMs: RUN_MS,
      stimulus: [
        { kind: 'serial', tMs: 100, data: 'LED ON\n' },
        { kind: 'serial', tMs: 300, data: 'PWM 128\n' },
        { kind: 'serial', tMs: 500, data: 'STATUS\n' },
        { kind: 'serial', tMs: 700, data: 'LED OFF\n' },
      ],
      contract: [
        pinState(7, 1, { window: { fromMs: 200, toMs: 650 } }), // on until LED OFF
        pinState(7, 0, { window: { fromMs: 800, toMs: RUN_MS } }), // off after
        pwmDuty(3, { duty: duty(128) }),
        serialMatches(/OK LED=ON\r?\n/),
        serialMatches(/OK PWM=128\r?\n/),
        serialMatches(/STATUS LED=ON PWM=128\r?\n/),
        serialMatches(/OK LED=OFF\r?\n/),
      ],
    },
    {
      id: 'case-and-spaces',
      description: 'Lower-case + padded commands must work; replies are uppercase (kills case-sensitive).',
      budgetMs: 800,
      stimulus: [
        { kind: 'serial', tMs: 100, data: '  led on  \n' },
        { kind: 'serial', tMs: 300, data: 'pwm 200\n' },
        { kind: 'serial', tMs: 500, data: 'Status\n' },
      ],
      contract: [
        pinState(7, 1, { window: { fromMs: 200, toMs: 800 } }),
        pwmDuty(3, { duty: duty(200) }),
        serialMatches(/OK LED=ON\r?\n/),
        serialMatches(/OK PWM=200\r?\n/),
        serialMatches(/STATUS LED=ON PWM=200\r?\n/),
      ],
    },
    {
      id: 'error-handling',
      description: 'Out-of-range/unknown/non-decimal/missing-arg all reply ERR and change nothing.',
      budgetMs: 1200,
      stimulus: [
        { kind: 'serial', tMs: 100, data: 'PWM 100\n' }, // valid → duty 100/255
        { kind: 'serial', tMs: 300, data: 'PWM 300\n' }, // out of range → ERR, no change
        { kind: 'serial', tMs: 500, data: 'FOO\n' }, // unknown → ERR
        { kind: 'serial', tMs: 700, data: 'PWM abc\n' }, // non-decimal → ERR
        { kind: 'serial', tMs: 900, data: 'LED\n' }, // missing arg → ERR
      ],
      contract: [
        pwmDuty(3, { duty: duty(100) }), // unchanged by the invalid PWM 300 (kills no-range-check)
        pinState(7, 0, { window: { fromMs: 50, toMs: 1200 } }), // LED never turned on
        serialMatches(/ERR\r?\n/),
      ],
    },
    {
      id: 'overlong-recovery',
      description: 'An overlong line replies ERR once, then a valid command is accepted.',
      budgetMs: 800,
      stimulus: [
        { kind: 'serial', tMs: 100, data: 'LED ONNNNNNNNNNNNNNNNNNNNNNNNNN\n' }, // >20 chars → overlong
        { kind: 'serial', tMs: 400, data: 'LED ON\n' }, // recovered
      ],
      contract: [
        serialMatches(/ERR\r?\n/),
        pinState(7, 1, { window: { fromMs: 500, toMs: 800 } }),
      ],
    },
    {
      id: 'pwm-boundary',
      description: 'PWM 255 → full duty; the reply echoes the boundary value.',
      budgetMs: 500,
      stimulus: [{ kind: 'serial', tMs: 100, data: 'PWM 255\n' }],
      contract: [
        pwmDuty(3, { duty: 1 }),
        serialMatches(/OK PWM=255\r?\n/),
        serialAbsent(/ERR/), // a boundary-valid value must not error
      ],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  // Base contract (bare runner, no RX): both outputs stay at 0, no spurious reply.
  contract: [
    pinState(7, 0, { window: { fromMs: 50, toMs: RUN_MS } }),
    pwmDuty(3, { duty: 0 }),
    serialAbsent(/OK|STATUS|ERR/),
  ],
};

export default task;
