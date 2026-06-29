import { describe, it, expect } from 'vitest';
import { buildProject } from '../scenarios/uno-led-blink/circuit';
import { ledBlinks, pinFrequency, pinDutyCycle } from '../contracts/assertions';
import type { Trace, PinEdge } from '../harness/trace';
import type { AssertionContext } from '../contracts/types';

const ctx: AssertionContext = { circuit: buildProject('') };

/** Build a square-wave trace on `pin` with the given half-period (ms). */
function squareWave(pin: number, halfPeriodMs: number, cycles: number): Trace {
  const pinEdges: PinEdge[] = [];
  let t = 0;
  for (let i = 0; i < cycles; i++) {
    pinEdges.push({ tMs: t, pin, value: 1 });
    t += halfPeriodMs;
    pinEdges.push({ tMs: t, pin, value: 0 });
    t += halfPeriodMs;
  }
  return { pinEdges, serial: [], durationMs: t, finalState: {} };
}

describe('ledBlinks', () => {
  it('passes a 1 Hz / 50% blink on the resolved pin', () => {
    const trace = squareWave(13, 500, 3); // 1 Hz, duty 0.5
    const r = ledBlinks({ component: 'bench_led', hz: 1, dutyCycle: 0.5 })(trace, ctx);
    expect(r.pass).toBe(true);
    expect(r.reason).toMatch(/pin 13/);
  });

  it('fails a wrong frequency (2 Hz vs 1 Hz expected)', () => {
    const trace = squareWave(13, 250, 6); // 2 Hz
    const r = ledBlinks({ component: 'bench_led', hz: 1 })(trace, ctx);
    expect(r.pass).toBe(false);
  });

  it('fails a stuck-on LED (no periods) via the minPeriods guard', () => {
    const trace: Trace = {
      pinEdges: [{ tMs: 0, pin: 13, value: 1 }],
      serial: [],
      durationMs: 3000,
      finalState: {},
    };
    const r = ledBlinks({ component: 'bench_led', hz: 1 })(trace, ctx);
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/stuck|period/i);
  });

  it('accepts frequency within tolerance and rejects just outside it', () => {
    // 1.04 Hz ≈ +4% (within 5%), 1.12 Hz ≈ +12% (outside).
    expect(pinFrequency(13, { hz: 1 })(squareWave(13, 480, 4), ctx).pass).toBe(true);
    expect(pinFrequency(13, { hz: 1 })(squareWave(13, 446, 4), ctx).pass).toBe(false);
  });

  it('checks duty cycle independently', () => {
    const trace = squareWave(13, 500, 3); // duty 0.5
    expect(pinDutyCycle(13, { duty: 0.5 })(trace, ctx).pass).toBe(true);
    expect(pinDutyCycle(13, { duty: 0.9 })(trace, ctx).pass).toBe(false);
  });
});
