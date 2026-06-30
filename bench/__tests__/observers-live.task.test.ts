/**
 * Pass 3 success criteria, end-to-end against the live backend:
 *   - hardware-PWM duty is observed (OCR-derived) and graded — a wrong duty fails;
 *   - the value/format split grades a serial number semantically while a wrong
 *     format only loses the format assertion (correct logic keeps the majority);
 *   - serial-RX injection delivers bytes the firmware reads back;
 *   - the new pwm/serial channels are byte-identical across 3 fresh instances.
 * Self-skips when the backend is down.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { compile } from '../compile/compileClient';
import { AVRHarness } from '../harness/AVRHarness';
import { runWithStimulus, type StimulusEvent } from '../harness/stimulus';
import { serialText, type Trace } from '../harness/trace';
import { pwmDuty, adcDerivedValue, serialMatches, serialValue } from '../contracts/dsl';
import { variantScore } from '../runner/score';
import { buildProject } from '../scenarios/uno-led-blink/circuit';
import type { AssertionContext } from '../contracts/types';

const API_BASE = process.env.BENCH_API_BASE ?? 'http://127.0.0.1:8001';
const ctx: AssertionContext = { circuit: buildProject('') };

async function backendUp(): Promise<boolean> {
  try {
    return (await fetch(`${API_BASE}/docs`)).ok;
  } catch {
    return false;
  }
}

async function runSketch(sketch: string, budgetMs: number, stimulus: StimulusEvent[] = []): Promise<Trace> {
  const compiled = await compile([{ name: 'sketch.ino', content: sketch }], 'arduino:avr:uno', API_BASE);
  expect(compiled.ok, compiled.stderr).toBe(true);
  const h = new AVRHarness();
  h.load(compiled.hex!);
  runWithStimulus(h, budgetMs, stimulus);
  return h.trace();
}

const PWM_SKETCH = `
void setup() { pinMode(9, OUTPUT); analogWrite(9, 128); } // ~50% duty
void loop() {}
`;

// Reads A0, prints volts*100 as "TEMP_C=NN.N".
const TEMP_SKETCH = `
void setup() { Serial.begin(9600); }
void loop() {
  int a = analogRead(A0);
  float t = (a * 5.0 / 1023.0) * 100.0;
  Serial.print("TEMP_C="); Serial.println(t, 1);
  delay(100);
}
`;

const ECHO_SKETCH = `
void setup() { Serial.begin(9600); }
void loop() { if (Serial.available()) Serial.write(Serial.read()); }
`;

describe('observers (live backend)', () => {
  let up = false;
  beforeAll(async () => {
    up = await backendUp();
    if (!up) console.warn(`[observers] backend ${API_BASE} unreachable — skipping.`);
  });

  it('grades hardware-PWM duty from OCR; a wrong duty fails', async (c) => {
    if (!up) return c.skip();
    const trace = await runSketch(PWM_SKETCH, 100);
    expect(trace.pwmSamples.some((s) => s.pin === 9)).toBe(true);
    expect(pwmDuty(9, { duty: 0.5 })(trace, ctx).pass).toBe(true);
    expect(pwmDuty(9, { duty: 0.25 })(trace, ctx).pass).toBe(false);
  }, 60_000);

  it('value/format split: correct value with wrong format keeps the majority', async (c) => {
    if (!up) return c.skip();
    // Inject A0 ≈ 2.0 V → temp ≈ 200.0.
    const trace = await runSketch(TEMP_SKETCH, 600, [{ kind: 'adc', tMs: 0, channel: 0, volts: 2.0 }]);
    // Semantic value passes (derived from the injected stimulus).
    expect(adcDerivedValue({ pattern: /TEMP_C=(\d+\.\d+)/, expected: 200, tolerance: 2 })(trace, ctx).pass).toBe(true);
    // The reference format matches; an over-strict wrong format does not.
    const [semantic, goodFormat] = serialValue({
      pattern: /TEMP_C=(\d+\.\d+)/,
      expected: 200,
      tolerance: 2,
      formatRegex: /TEMP_C=\d+\.\d+/,
    });
    expect(variantScore([semantic(trace, ctx), goodFormat(trace, ctx)])).toBeCloseTo(1, 5);
    const [sem2, badFormat] = serialValue({
      pattern: /TEMP_C=(\d+\.\d+)/,
      expected: 200,
      tolerance: 2,
      formatRegex: /^TEMPERATURE: \d+\.\d+ C$/m, // a different, wrong shape
    });
    // Correct logic, wrong format → 0.7 (semantic majority), not 0.
    expect(variantScore([sem2(trace, ctx), badFormat(trace, ctx)])).toBeCloseTo(0.7, 5);
  }, 60_000);

  it('serial-RX injection: the firmware reads back injected bytes', async (c) => {
    if (!up) return c.skip();
    const trace = await runSketch(ECHO_SKETCH, 500, [{ kind: 'serial', tMs: 50, data: 'Hi!' }]);
    expect(trace.serialInputs.map((s) => s.char).join('')).toBe('Hi!');
    expect(serialMatches(/Hi!/)(trace, ctx).pass).toBe(true);
    expect(serialText(trace)).toContain('Hi!');
  }, 60_000);

  it('is deterministic: pwm + serial channels identical across 3 fresh runs', async (c) => {
    if (!up) return c.skip();
    const compiled = await compile([{ name: 'sketch.ino', content: TEMP_SKETCH }], 'arduino:avr:uno', API_BASE);
    expect(compiled.ok, compiled.stderr).toBe(true);
    const stim: StimulusEvent[] = [{ kind: 'adc', tMs: 0, channel: 0, volts: 2.0 }];
    const sig = () => {
      const h = new AVRHarness();
      h.load(compiled.hex!);
      runWithStimulus(h, 600, stim);
      const t = h.trace();
      return JSON.stringify({ pwm: t.pwmSamples, serial: t.serial, rx: t.serialInputs });
    };
    const a = sig();
    expect(sig()).toBe(a);
    expect(sig()).toBe(a);
  }, 90_000);
});
