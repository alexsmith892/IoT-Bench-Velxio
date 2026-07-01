import { buildProject } from '../../scenarios/binary-framed-protocol/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { serialBytesInclude, pinState, pwmDuty } from '../../contracts/dsl';
import type { StimulusEvent } from '../../harness/stimulus';
import type { OneShotScenario } from '../types';

// OS-D3-07. Binary framed protocol @115200 (no text): 0xAA,LEN,CMD,PAYLOAD,CHK.
// CMD 0x01 sets LED (D7), 0x02 sets PWM (D3), 0x03 reports state; success/NAK use
// the 0x55 frame form. Graded on the exact binary responses (`serial-format` via
// serialBytesInclude), the physical effect (D7 `pin-state`, D3 `pwm-duty` — the
// bad-checksum discriminator leaves the output unchanged), and recovery after a
// garbage/oversized frame (the resync discriminator).
const SCENARIO_DIR = new URL('../../scenarios/binary-framed-protocol/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const RUN_MS = 600;
const duty = (n: number) => n / 255;
const frame = (tMs: number, arr: number[]): StimulusEvent => ({
  kind: 'serial',
  tMs,
  data: String.fromCharCode(...arr.map((b) => b & 0xff)),
});

// Request frames (checksum = XOR of LEN, CMD, payload…).
const REQ_LED_ON = [0xaa, 0x02, 0x01, 0x01, 0x02];
const REQ_PWM_200 = [0xaa, 0x02, 0x02, 0xc8, 0xc8];
const REQ_PWM_128 = [0xaa, 0x02, 0x02, 0x80, 0x80];
const REQ_STATUS = [0xaa, 0x01, 0x03, 0x02];
const REQ_BAD_CHK = [0xaa, 0x02, 0x02, 0xc8, 0x00]; // PWM frame, wrong checksum
const REQ_BAD_LEN = [0xaa, 0x11]; // LEN=17 > 16
// Expected responses.
const RSP_LED_ON = [0x55, 0x02, 0x01, 0x01, 0x02];
const RSP_PWM_200 = [0x55, 0x02, 0x02, 0xc8, 0xc8];
const RSP_STATUS = [0x55, 0x03, 0x03, 0x01, 0x80, 0x81]; // led=1, pwm=128
const NAK_CHK = [0x55, 0x02, 0x7f, 0x01, 0x7c]; // ERROR=1 (checksum)
const NAK_VALID = [0x55, 0x02, 0x7f, 0x02, 0x7f]; // ERROR=2 (other validation)

export const task: OneShotScenario = {
  id: 'binary-framed-protocol',
  difficulty: 'D3',
  domain: 'serial-protocol',
  tiers: ['B'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno implementing a binary serial protocol at ' +
    '115200 baud. Emit no text.\n\n' +
    'Each request frame is: 0xAA, LEN, CMD, PAYLOAD..., CHECKSUM. LEN is the number of bytes from ' +
    'CMD through the end of PAYLOAD, so it is at least 1. CHECKSUM is the XOR of LEN, CMD, and every ' +
    'payload byte. Parse the stream incrementally: bytes can arrive with arbitrary gaps, garbage can ' +
    'appear before a start byte, and a bad frame must not prevent parsing the next valid frame. ' +
    'Reject any frame whose LEN exceeds 16.\n\n' +
    'An active-high LED is on digital pin 7 and a PWM output on digital pin 3; both start at 0. ' +
    'Commands:\n' +
    '- CMD 0x01 with one payload byte 0 or 1: set the LED and send a success response.\n' +
    '- CMD 0x02 with one payload byte 0..255: set PWM and send a success response.\n' +
    '- CMD 0x03 with no payload: send the current LED and PWM state.\n\n' +
    'A success response is 0x55, LEN, CMD, PAYLOAD..., CHECKSUM using the same LEN/checksum rules: ' +
    'for 0x01 echo the accepted LED byte; for 0x02 echo the PWM byte; for 0x03 return two payload ' +
    'bytes, LED then PWM. For a complete frame with bad checksum, invalid length, unknown command, ' +
    'or wrong payload length/value, leave outputs unchanged and send the NAK frame 0x55, 0x02, ' +
    '0x7F, ERROR, CHECKSUM, where ERROR is 1 for a checksum failure and 2 for every other ' +
    'validation failure.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its ' +
    'bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'ignore-checksum',
      files: ['wrongs/ignore-checksum.ino'],
      expectFailCategory: 'pwm-duty',
      description: 'Never verifies the checksum, so a corrupt PWM frame still drives the output.',
    },
    {
      id: 'no-resync',
      files: ['wrongs/no-resync.ino'],
      expectFailCategory: 'serial-format',
      description: 'Does not reject LEN>16, so an oversized frame swallows the next valid frame.',
    },
  ],
  variants: [
    {
      id: 'set-led',
      description: 'CMD 0x01 payload 1 → LED HIGH + success response.',
      budgetMs: RUN_MS,
      stimulus: [frame(50, REQ_LED_ON)],
      contract: [
        pinState(7, 1, { window: { fromMs: 150, toMs: RUN_MS } }),
        serialBytesInclude(RSP_LED_ON),
      ],
    },
    {
      id: 'set-pwm',
      description: 'CMD 0x02 payload 200 → PWM duty 200/255 + success response.',
      budgetMs: RUN_MS,
      stimulus: [frame(50, REQ_PWM_200)],
      contract: [
        pwmDuty(3, { duty: duty(200) }),
        serialBytesInclude(RSP_PWM_200),
      ],
    },
    {
      id: 'status',
      description: 'Set LED + PWM, then CMD 0x03 → reports LED,PWM in one frame.',
      budgetMs: RUN_MS,
      stimulus: [frame(50, REQ_LED_ON), frame(150, REQ_PWM_128), frame(250, REQ_STATUS)],
      contract: [
        pinState(7, 1, { window: { fromMs: 350, toMs: RUN_MS } }),
        pwmDuty(3, { duty: duty(128) }),
        serialBytesInclude(RSP_STATUS),
      ],
    },
    {
      id: 'bad-checksum',
      description: 'A PWM frame with a wrong checksum → output unchanged + NAK ERROR=1.',
      budgetMs: RUN_MS,
      stimulus: [frame(50, REQ_BAD_CHK)],
      contract: [
        pwmDuty(3, { duty: 0 }),                                  // unchanged (kills ignore-checksum)
        pinState(7, 0, { window: { fromMs: 50, toMs: RUN_MS } }),
        serialBytesInclude(NAK_CHK),
      ],
    },
    {
      id: 'recovery',
      description: 'Garbage + an oversized (LEN>16) frame, then a valid frame → NAK then recover.',
      budgetMs: RUN_MS,
      stimulus: [
        frame(30, [0x00, 0x99, 0x12]), // garbage before a start byte (skipped)
        frame(90, REQ_BAD_LEN),        // LEN=17 → NAK ERROR=2, must resync
        frame(200, REQ_LED_ON),        // valid frame after the bad one
      ],
      contract: [
        serialBytesInclude(NAK_VALID),                            // NAK ERROR=2 for the bad length
        serialBytesInclude(RSP_LED_ON),                           // recovered frame's success (kills no-resync)
        pinState(7, 1, { window: { fromMs: 320, toMs: RUN_MS } }), // LED actually set by the recovered frame
      ],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  // Base contract (bare runner, no frames): outputs stay at 0.
  contract: [
    pinState(7, 0, { window: { fromMs: 50, toMs: RUN_MS } }),
    pwmDuty(3, { duty: 0 }),
  ],
};

export default task;
