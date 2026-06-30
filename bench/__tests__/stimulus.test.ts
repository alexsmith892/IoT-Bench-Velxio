/**
 * Pure scheduler tests for `harness/stimulus.ts` — no backend. Proves the
 * ordering/expansion logic that the reproducibility of every stimulus task
 * depends on (Pass 2 reflection focus: ordering ambiguity at equal timestamps).
 */
import { describe, it, expect } from 'vitest';
import {
  resolveStimulus,
  runWithStimulus,
  type StimulusEvent,
  type StimulusTarget,
} from '../harness/stimulus';

/** Records each applied event tagged with the virtual time it was applied at. */
class MockTarget implements StimulusTarget {
  now = 0;
  log: string[] = [];
  runUntilMs(ms: number): void {
    if (ms > this.now) this.now = ms; // monotonic, like the real harness
  }
  setPin(pin: number, level: 0 | 1): void {
    this.log.push(`${this.now}:pin${pin}=${level}`);
  }
  setAnalogVoltage(ch: number, v: number): void {
    this.log.push(`${this.now}:adc${ch}=${v.toFixed(2)}`);
  }
}

describe('resolveStimulus', () => {
  it('sorts by tMs ascending regardless of input order', () => {
    const ev: StimulusEvent[] = [
      { kind: 'pin', tMs: 500, pin: 2, level: 0 },
      { kind: 'pin', tMs: 0, pin: 2, level: 1 },
      { kind: 'adc', tMs: 200, channel: 0, volts: 1 },
    ];
    expect(resolveStimulus(ev).map((r) => r.tMs)).toEqual([0, 200, 500]);
  });

  it('expands an adcRamp into inclusive linear steps', () => {
    const t = new MockTarget();
    runWithStimulus(t, 100, [
      { kind: 'adcRamp', tMs: 0, channel: 0, fromVolts: 0, toVolts: 4, durationMs: 40, stepMs: 10 },
    ]);
    expect(t.log).toEqual([
      '0:adc0=0.00',
      '10:adc0=1.00',
      '20:adc0=2.00',
      '30:adc0=3.00',
      '40:adc0=4.00',
    ]);
  });
});

describe('runWithStimulus', () => {
  it('applies events in time order and runs to the budget', () => {
    const t = new MockTarget();
    runWithStimulus(t, 1000, [
      { kind: 'pin', tMs: 500, pin: 2, level: 0 },
      { kind: 'pin', tMs: 0, pin: 2, level: 1 },
    ]);
    expect(t.log).toEqual(['0:pin2=1', '500:pin2=0']);
    expect(t.now).toBe(1000);
  });

  it('breaks equal-timestamp ties by authoring order (deterministic)', () => {
    const t = new MockTarget();
    runWithStimulus(t, 200, [
      { kind: 'pin', tMs: 100, pin: 2, level: 1 },
      { kind: 'pin', tMs: 100, pin: 3, level: 0 },
    ]);
    expect(t.log).toEqual(['100:pin2=1', '100:pin3=0']);
  });

  it('drops events scheduled past the budget', () => {
    const t = new MockTarget();
    runWithStimulus(t, 300, [
      { kind: 'pin', tMs: 100, pin: 2, level: 0 },
      { kind: 'pin', tMs: 999, pin: 2, level: 1 },
    ]);
    expect(t.log).toEqual(['100:pin2=0']);
    expect(t.now).toBe(300);
  });
});
