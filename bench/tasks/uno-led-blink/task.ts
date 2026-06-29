import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildProject } from '../../scenarios/uno-led-blink/circuit';
import { ledBlinks } from '../../contracts/assertions';
import type { BenchTask } from '../types';

// Single source of truth: the firmware text and circuit wiring both come from
// `bench/scenarios/uno-led-blink/` — the same files the visual inspection page
// renders. Node reads the sketch via `fs` (the inspection registry uses Vite
// `?raw`); the wiring is the shared `buildProject`.
const sketch = readFileSync(
  fileURLToPath(new URL('../../scenarios/uno-led-blink/sketch.ino', import.meta.url)),
  'utf8',
);

export const task: BenchTask = {
  id: 'uno-led-blink',
  board: 'arduino:avr:uno',
  circuit: buildProject(sketch),
  referenceFirmware: [{ name: 'sketch.ino', content: sketch }],
  runMs: 3000,
  contract: [ledBlinks({ component: 'bench_led', hz: 1, dutyCycle: 0.5 })],
};

export default task;
