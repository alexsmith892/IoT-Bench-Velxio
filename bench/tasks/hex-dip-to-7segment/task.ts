import { buildProject } from '../../scenarios/hex-dip-to-7segment/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { pinState } from '../../contracts/dsl';
import type { Assertion } from '../../contracts/types';
import type { StimulusEvent } from '../../harness/stimulus';
import type { OneShotScenario } from '../types';

// OS-D1-05. DIP switches D2..D5 (INPUT_PULLUP, closed = LOW = 1, D2 = bit0) →
// common-cathode seven-segment a..g on D6..D12 (active-high). Graded directly on
// the seven segment pin levels (category `pin-state`) against the conventional hex
// glyph — no decoder needed. The hex-letter variant kills a decimal-only solution.
const SCENARIO_DIR = new URL('../../scenarios/hex-dip-to-7segment/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

const RUN_MS = 600;
const SW_PINS = [2, 3, 4, 5]; // bit 0..3
const SEG_PINS = [6, 7, 8, 9, 10, 11, 12]; // a..g
// Bit 6 = segment a … bit 0 = segment g (matches the reference FONT table).
const FONT = [
  0b1111110, 0b0110000, 0b1101101, 0b1111001, 0b0110011, 0b1011011, 0b1011111, 0b1110000,
  0b1111111, 0b1111011, 0b1110111, 0b0011111, 0b1001110, 0b0111101, 0b1001111, 0b1000111,
];

/** Stimulus to present 4-bit `value` on the DIP switches (closed = LOW = bit set). */
function setValue(value: number, tMs: number): StimulusEvent[] {
  return SW_PINS.map((pin, i) => ({
    kind: 'pin' as const,
    tMs,
    pin,
    level: (value >> i) & 1 ? 0 : 1, // bit set → switch closed → LOW
  }));
}

/** Assert every segment pin matches the hex glyph for `value` across a window. */
function glyphContract(value: number, window: { fromMs: number; toMs: number }): Assertion[] {
  const pattern = FONT[value];
  return SEG_PINS.map((pin, i) => {
    const bit = ((pattern >> (6 - i)) & 1) as 0 | 1;
    return pinState(pin, bit, { window });
  });
}

export const task: OneShotScenario = {
  id: 'hex-dip-to-7segment',
  difficulty: 'D1',
  domain: 'GPIO/display',
  tiers: ['A'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno that shows a 4-bit input as one ' +
    'hexadecimal digit on a common-cathode seven-segment display.\n\n' +
    'Four DIP switches connect from digital pins 2, 3, 4, and 5 to ground; configure them with ' +
    'INPUT_PULLUP. Pin 2 is bit 0 (least significant) and pin 5 is bit 3. A closed switch reads ' +
    'LOW and represents 1; an open switch reads HIGH and represents 0.\n\n' +
    'Display segments a, b, c, d, e, f, and g connect in that order to digital pins 6, 7, 8, 9, ' +
    '10, 11, and 12 and are active-high. Show the current switch value as uppercase hexadecimal 0 ' +
    'through F, using the conventional glyphs (A, b, C, d, E, F for values 10 through 15), ' +
    'updating within 10 ms of an input change.\n\n' +
    'Submit one complete .ino sketch with setup() and loop(); use only the Arduino core and its ' +
    'bundled libraries.',
  referenceSolution,
  adversarialWrongs: [
    {
      id: 'decimal-only',
      files: ['wrongs/decimal-only.ino'],
      expectFailCategory: 'pin-state',
      description: 'Blanks values 10..15 instead of showing A..F.',
    },
    {
      id: 'inverted-segments',
      files: ['wrongs/inverted-segments.ino'],
      expectFailCategory: 'pin-state',
      description: 'Drives segments active-low (common-anode wiring).',
    },
  ],
  variants: [
    {
      id: 'value-0',
      description: 'All switches open → 0 (boundary).',
      budgetMs: RUN_MS,
      stimulus: setValue(0, 0),
      contract: glyphContract(0, { fromMs: 60, toMs: 580 }),
    },
    {
      id: 'value-F',
      description: 'All switches closed → F (boundary + hex letter).',
      budgetMs: RUN_MS,
      stimulus: setValue(15, 0),
      contract: glyphContract(15, { fromMs: 60, toMs: 580 }),
    },
    {
      id: 'value-b',
      description: 'Value 11 → b — a decimal-only decoder fails here.',
      budgetMs: RUN_MS,
      stimulus: setValue(11, 0),
      contract: glyphContract(11, { fromMs: 60, toMs: 580 }),
    },
    {
      id: 'changing-value',
      description: 'Value 5 then changes to A mid-run; the display must update.',
      budgetMs: 700,
      stimulus: [...setValue(5, 0), ...setValue(10, 350)],
      contract: [
        ...glyphContract(5, { fromMs: 60, toMs: 300 }),
        ...glyphContract(10, { fromMs: 410, toMs: 680 }),
      ],
    },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: RUN_MS,
  // Base contract (bare runner, no stimulus → all switches open → value 0).
  contract: glyphContract(0, { fromMs: 60, toMs: RUN_MS }),
};

export default task;
