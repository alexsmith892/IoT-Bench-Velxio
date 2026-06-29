/**
 * Regression for the INPUT_PULLUP false positive (the bug class
 * visual-led-test.mjs guards). Writing 1 to PORT on a pin configured
 * INPUT_PULLUP enables the pullup — it does NOT drive the pin HIGH. The harness
 * must record ZERO driven edges, even though the PORT register bit toggles.
 *
 * Needs the Velxio backend (compiles real firmware); self-skips when down.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { compile } from '../compile/compileClient';
import { AVRHarness } from '../harness/AVRHarness';
import { edgesForPin } from '../harness/trace';

const API_BASE = process.env.BENCH_API_BASE ?? 'http://127.0.0.1:8001';

async function backendUp(): Promise<boolean> {
  try {
    return (await fetch(`${API_BASE}/api/compile/`, { method: 'OPTIONS' })).status < 500;
  } catch {
    return false;
  }
}

// Pin 13 is INPUT_PULLUP and then "toggled" — PORT bit moves, but nothing is
// ever driven. A naive PORT-bit recorder would log a 5 Hz blink here.
const PULLUP_SKETCH = `
constexpr int PIN = 13;
void setup() { pinMode(PIN, INPUT_PULLUP); }
void loop() {
  digitalWrite(PIN, HIGH); delay(100);
  digitalWrite(PIN, LOW);  delay(100);
}
`;

// Control: the same pin as a real OUTPUT must still record edges.
const OUTPUT_SKETCH = `
constexpr int PIN = 13;
void setup() { pinMode(PIN, OUTPUT); }
void loop() {
  digitalWrite(PIN, HIGH); delay(100);
  digitalWrite(PIN, LOW);  delay(100);
}
`;

async function tracePin13(sketch: string) {
  const compiled = await compile([{ name: 'sketch.ino', content: sketch }], 'arduino:avr:uno', API_BASE);
  expect(compiled.ok, compiled.stderr).toBe(true);
  const h = new AVRHarness();
  h.load(compiled.hex!);
  h.runUntilMs(1000);
  return edgesForPin(h.trace(), 13);
}

describe('DDR-aware edge recording', () => {
  let available = false;
  beforeAll(async () => {
    available = await backendUp();
    if (!available) console.warn(`[ddr] backend ${API_BASE} unreachable — skipping.`);
  });

  it('records NO driven edges for an INPUT_PULLUP pin being toggled', async (c) => {
    if (!available) return c.skip();
    expect(await tracePin13(PULLUP_SKETCH)).toHaveLength(0);
  }, 60_000);

  it('still records edges for the same pin as a real OUTPUT (control)', async (c) => {
    if (!available) return c.skip();
    expect((await tracePin13(OUTPUT_SKETCH)).length).toBeGreaterThan(2);
  }, 60_000);
});
