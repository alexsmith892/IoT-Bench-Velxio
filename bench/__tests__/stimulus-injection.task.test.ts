/**
 * Pass 2 success criteria, end-to-end against the live backend: a firmware that
 * mirrors a button to an LED follows injected pin stimulus; a firmware that
 * thresholds an ADC reading follows an injected ramp (and the ramp is echoed);
 * and the trace is byte-identical across 3 fresh harness instances (reset
 * isolation + deterministic scheduling). Self-skips when the backend is down.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { compile } from '../compile/compileClient';
import { AVRHarness } from '../harness/AVRHarness';
import { runWithStimulus, type StimulusEvent } from '../harness/stimulus';
import { edgesForPin, type Trace } from '../harness/trace';

const API_BASE = process.env.BENCH_API_BASE ?? 'http://127.0.0.1:8001';
async function backendUp(): Promise<boolean> {
  try {
    return (await fetch(`${API_BASE}/docs`)).ok;
  } catch {
    return false;
  }
}

const BTN_MIRROR = `
const int BTN = 2, LED = 13;
void setup() { pinMode(BTN, INPUT_PULLUP); pinMode(LED, OUTPUT); digitalWrite(LED, LOW); }
void loop() { digitalWrite(LED, digitalRead(BTN) == LOW ? HIGH : LOW); }
`;

const ADC_THRESHOLD = `
const int LED = 13;
void setup() { pinMode(LED, OUTPUT); }
void loop() { digitalWrite(LED, analogRead(A0) > 512 ? HIGH : LOW); }
`;

async function runSketch(sketch: string, budgetMs: number, stimulus: StimulusEvent[]): Promise<Trace> {
  const compiled = await compile([{ name: 'sketch.ino', content: sketch }], 'arduino:avr:uno', API_BASE);
  expect(compiled.ok, compiled.stderr).toBe(true);
  const h = new AVRHarness();
  h.load(compiled.hex!);
  runWithStimulus(h, budgetMs, stimulus);
  return h.trace();
}

/** Driven level of `pin` at `tMs` — value of the last edge at/before tMs (default 0). */
function levelAt(trace: Trace, pin: number, tMs: number): 0 | 1 {
  let level: 0 | 1 = 0;
  for (const e of edgesForPin(trace, pin)) {
    if (e.tMs <= tMs) level = e.value;
    else break;
  }
  return level;
}

describe('stimulus injection (live backend)', () => {
  let up = false;
  beforeAll(async () => {
    up = await backendUp();
    if (!up) console.warn(`[stimulus] backend ${API_BASE} unreachable — skipping.`);
  });

  it('drives an input pin: the LED mirrors a button press', async (c) => {
    if (!up) return c.skip();
    const trace = await runSketch(BTN_MIRROR, 1500, [
      { kind: 'pin', tMs: 0, pin: 2, level: 1 }, // released (HIGH via pullup)
      { kind: 'pin', tMs: 500, pin: 2, level: 0 }, // pressed (LOW to GND)
      { kind: 'pin', tMs: 1000, pin: 2, level: 1 }, // released
    ]);
    expect(levelAt(trace, 13, 250)).toBe(0); // before press
    expect(levelAt(trace, 13, 750)).toBe(1); // during press
    expect(levelAt(trace, 13, 1250)).toBe(0); // after release
  }, 60_000);

  it('injects an ADC ramp: the LED crosses the threshold, ramp is echoed', async (c) => {
    if (!up) return c.skip();
    const trace = await runSketch(ADC_THRESHOLD, 1200, [
      { kind: 'adcRamp', tMs: 0, channel: 0, fromVolts: 0, toVolts: 5, durationMs: 1000, stepMs: 50 },
    ]);
    expect(levelAt(trace, 13, 250)).toBe(0); // ~1.25 V → ADC ~256 < 512
    expect(levelAt(trace, 13, 900)).toBe(1); // ~4.5 V → ADC ~921 > 512
    // The ramp is echoed into adcInputs and spans 0 → 5 V on channel 0.
    expect(trace.adcInputs.length).toBeGreaterThan(10);
    expect(trace.adcInputs[0].channel).toBe(0);
    expect(trace.adcInputs.at(-1)!.volts).toBeCloseTo(5, 1);
  }, 60_000);

  it('is deterministic: 3 fresh harness instances give identical traces', async (c) => {
    if (!up) return c.skip();
    const compiled = await compile([{ name: 'sketch.ino', content: BTN_MIRROR }], 'arduino:avr:uno', API_BASE);
    expect(compiled.ok, compiled.stderr).toBe(true);
    const stim: StimulusEvent[] = [
      { kind: 'pin', tMs: 0, pin: 2, level: 1 },
      { kind: 'pin', tMs: 400, pin: 2, level: 0 },
      { kind: 'pin', tMs: 800, pin: 2, level: 1 },
    ];
    const sig = () => {
      const h = new AVRHarness();
      h.load(compiled.hex!);
      runWithStimulus(h, 1200, stim);
      const t = h.trace();
      return JSON.stringify({ pins: t.pinEdges, adc: t.adcInputs });
    };
    const a = sig();
    expect(sig()).toBe(a);
    expect(sig()).toBe(a);
  }, 90_000);
});
