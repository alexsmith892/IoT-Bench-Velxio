import { buildProject } from '../../scenarios/uno-led-blink/circuit';
import { readSketchFiles } from '../../scenarios/firmware';
import { ledBlinks } from '../../contracts/assertions';
import type { OneShotScenario } from '../types';

// Single source of truth: the firmware text and circuit wiring both come from
// `bench/scenarios/uno-led-blink/` — the same files the visual inspection page
// renders. `referenceSolution` (paths) is canonical; `referenceFirmware` content
// is read from those paths via `readSketchFiles` (no hand-sync). The wiring is
// the shared `buildProject`, built from the resolved sketch text.
const SCENARIO_DIR = new URL('../../scenarios/uno-led-blink/', import.meta.url);
const referenceSolution = ['sketch.ino'];
const referenceFirmware = readSketchFiles(SCENARIO_DIR, referenceSolution);
const resolveFirmware = (relPaths: string[]) => readSketchFiles(SCENARIO_DIR, relPaths);

/**
 * Worked example / template, not a scored bank family (the bank's blink folds
 * into `responsive_dual_scheduler`). It exercises every field of the
 * `OneShotScenario` schema so Pass-6+ tasks can be copied from it.
 */
export const task: OneShotScenario = {
  id: 'uno-led-blink',
  difficulty: 'D1',
  domain: 'GPIO/timing',
  tiers: ['A'],
  board: 'arduino:avr:uno',
  libraries: [],
  prompt:
    'Create a complete Arduino sketch for an Arduino Uno that blinks the built-in ' +
    'LED on digital pin 13 at 1 Hz with a 50% duty cycle, starting LOW. Submit one ' +
    'complete .ino sketch with setup() and loop(); use only the Arduino core and ' +
    'its bundled libraries.',
  referenceSolution,
  // Adversarial wrongs — both must fail on the FREQUENCY category (Pass 4 gate).
  adversarialWrongs: [
    {
      id: 'blink-2hz',
      files: ['wrongs/blink-2hz.ino'],
      expectFailCategory: 'frequency',
      description: 'Blinks at 2 Hz instead of 1 Hz.',
    },
    {
      id: 'blink-stuck-on',
      files: ['wrongs/blink-stuck-on.ino'],
      expectFailCategory: 'frequency',
      description: 'LED constantly HIGH — never blinks.',
    },
  ],
  // Three hidden variants. Blink has no inputs, so they differ only in the
  // observation window/budget — enough to exercise the variant runner + gate
  // (the worked-example fixture, not a scored bank family).
  variants: [
    { id: 'window-3s', description: 'Default 3 s observation.', budgetMs: 3000 },
    { id: 'window-4s', description: '4 s observation.', budgetMs: 4000 },
    { id: 'window-5s', description: 'Longer 5 s observation.', budgetMs: 5000 },
  ],
  circuit: buildProject(referenceFirmware[0].content),
  referenceFirmware,
  resolveFirmware,
  runMs: 3000,
  contract: [ledBlinks({ component: 'bench_led', hz: 1, dutyCycle: 0.5 })],
};

export default task;
