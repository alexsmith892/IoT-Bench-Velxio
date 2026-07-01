/**
 * Legacy runTask gating for the worked-example task: reference PASSES and
 * adversarial wrongs FAIL. Complements the full capability gate in gate.test.ts.
 *
 * Needs the Velxio backend running. Self-skips when unreachable.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import task from '../../../tasks/uno-led-blink/task';
import { runTask } from '../../../runner/runTask';
import { API_BASE, backendUp } from '../../helpers/liveBackend';

const WRONG_2HZ = `
constexpr int LED_PIN = 13;
void setup() { pinMode(LED_PIN, OUTPUT); }
void loop() {
  digitalWrite(LED_PIN, HIGH); delay(250);
  digitalWrite(LED_PIN, LOW);  delay(250);
}
`;

const WRONG_STUCK = `
constexpr int LED_PIN = 13;
void setup() { pinMode(LED_PIN, OUTPUT); digitalWrite(LED_PIN, HIGH); }
void loop() {}
`;

describe('gating: uno-led-blink (legacy runTask)', () => {
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
