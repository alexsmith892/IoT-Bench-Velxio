/**
 * Capability gating (benchmark-notes doc 03 §D): a task is only trusted once
 * its reference solution PASSES and at least one adversarial-wrong solution
 * FAILS. This proves the contract actually discriminates.
 *
 * Needs the Velxio backend running (uvicorn + arduino-cli + arduino:avr core).
 * The suite self-skips when the backend is unreachable so unit CI stays green.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import task from '../tasks/uno-led-blink/task';
import { runTask } from '../runner/runTask';

const API_BASE = process.env.BENCH_API_BASE ?? 'http://127.0.0.1:8001';

async function backendUp(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/docs`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

// A wrong solution: blinks at 2 Hz (delay 250) instead of 1 Hz.
const WRONG_2HZ = `
constexpr int LED_PIN = 13;
void setup() { pinMode(LED_PIN, OUTPUT); }
void loop() {
  digitalWrite(LED_PIN, HIGH); delay(250);
  digitalWrite(LED_PIN, LOW);  delay(250);
}
`;

// A wrong solution: LED stuck on (never toggles).
const WRONG_STUCK = `
constexpr int LED_PIN = 13;
void setup() { pinMode(LED_PIN, OUTPUT); digitalWrite(LED_PIN, HIGH); }
void loop() {}
`;

describe('gating: uno-led-blink', () => {
  let available = false;
  beforeAll(async () => {
    available = await backendUp();
    if (!available) {
      console.warn(`[gate] backend ${API_BASE} unreachable — skipping gating test.`);
    }
  });

  it('reference solution PASSES the contract', async (c) => {
    if (!available) return c.skip();
    const result = await runTask(task);
    expect(result.verdict, result.compileStderr || JSON.stringify(result.results)).toBe('PASS');
  }, 60_000);

  it('adversarial wrong (2 Hz) FAILS the contract', async (c) => {
    if (!available) return c.skip();
    const result = await runTask(task, [{ name: 'sketch.ino', content: WRONG_2HZ }]);
    expect(result.verdict).toBe('FAIL');
  }, 60_000);

  it('adversarial wrong (stuck on) FAILS the contract', async (c) => {
    if (!available) return c.skip();
    const result = await runTask(task, [{ name: 'sketch.ino', content: WRONG_STUCK }]);
    expect(result.verdict).toBe('FAIL');
  }, 60_000);
});
