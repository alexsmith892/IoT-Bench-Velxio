import { describe, it, expect } from 'vitest';
import {
  serialMatches,
  pinState,
  edgeOrder,
  pwmDuty,
  adcDerivedValue,
  serialValue,
} from '../contracts/dsl';
import { buildProject } from '../scenarios/uno-led-blink/circuit';
import type { Trace, PinEdge, SerialByte, PwmSample } from '../harness/trace';
import type { AssertionContext } from '../contracts/types';

const ctx: AssertionContext = { circuit: buildProject('') };

function makeTrace(p: Partial<Trace>): Trace {
  return {
    pinEdges: [],
    serial: [],
    adcInputs: [],
    pwmSamples: [],
    serialInputs: [],
    durationMs: 1000,
    finalState: {},
    ...p,
  };
}

const serialOf = (s: string): SerialByte[] =>
  [...s].map((char, i) => ({ tMs: i, char }));

describe('serialMatches (format)', () => {
  it('passes/fails a literal-shape regex and tags serial-format', () => {
    const trace = makeTrace({ serial: serialOf('TEMP_C=23.4\n') });
    const pass = serialMatches(/^TEMP_C=-?\d+\.\d+$/m)(trace, ctx);
    expect(pass.pass).toBe(true);
    expect(pass.category).toBe('serial-format');
    expect(serialMatches(/^HUMID=/m)(trace, ctx).pass).toBe(false);
  });

  it('everyMs requires recurrence', () => {
    const trace = makeTrace({ serial: serialOf('X\nX\nX\nX\n'), durationMs: 400 });
    expect(serialMatches(/X/, { everyMs: 100 })(trace, ctx).pass).toBe(true);
    const sparse = makeTrace({ serial: serialOf('X\n'), durationMs: 400 });
    expect(serialMatches(/X/, { everyMs: 100 })(sparse, ctx).pass).toBe(false);
  });
});

describe('pinState', () => {
  const edges: PinEdge[] = [
    { tMs: 0, pin: 7, value: 1 },
    { tMs: 500, pin: 7, value: 0 },
  ];
  it('checks an instant level', () => {
    const trace = makeTrace({ pinEdges: edges });
    expect(pinState(7, 1, { atMs: 200 })(trace, ctx).pass).toBe(true);
    expect(pinState(7, 1, { atMs: 600 })(trace, ctx).pass).toBe(false);
  });
  it('window mode fails when an opposite edge breaches it', () => {
    const trace = makeTrace({ pinEdges: edges });
    expect(pinState(7, 1, { window: { fromMs: 0, toMs: 400 } })(trace, ctx).pass).toBe(true);
    expect(pinState(7, 1, { window: { fromMs: 0, toMs: 600 } })(trace, ctx).pass).toBe(false);
  });
});

describe('edgeOrder', () => {
  const trace = makeTrace({
    pinEdges: [
      { tMs: 0, pin: 2, value: 1 },
      { tMs: 10, pin: 3, value: 1 },
      { tMs: 20, pin: 2, value: 0 },
    ],
  });
  it('passes an in-order subsequence and fails a wrong order', () => {
    expect(edgeOrder([{ pin: 2, value: 1 }, { pin: 2, value: 0 }])(trace, ctx).pass).toBe(true);
    expect(edgeOrder([{ pin: 2, value: 0 }, { pin: 2, value: 1 }])(trace, ctx).pass).toBe(false);
  });
  it('respects withinMs span', () => {
    const steps = [{ pin: 2 as const, value: 1 as const }, { pin: 2 as const, value: 0 as const }];
    expect(edgeOrder(steps, { withinMs: 5 })(trace, ctx).pass).toBe(false);
    expect(edgeOrder(steps, { withinMs: 100 })(trace, ctx).pass).toBe(true);
  });
});

describe('pwmDuty', () => {
  const samples: PwmSample[] = [
    { tMs: 0, pin: 9, duty: 0 },
    { tMs: 10, pin: 9, duty: 0.5 },
  ];
  it('grades the steady-state duty within absolute tolerance', () => {
    const trace = makeTrace({ pwmSamples: samples });
    expect(pwmDuty(9, { duty: 0.5 })(trace, ctx).pass).toBe(true);
    expect(pwmDuty(9, { duty: 0.75 })(trace, ctx).pass).toBe(false);
  });
  it('falls back to constant pin level when no PWM samples', () => {
    const trace = makeTrace({ pinEdges: [{ tMs: 0, pin: 9, value: 1 }] });
    expect(pwmDuty(9, { duty: 1 })(trace, ctx).pass).toBe(true);
    expect(pwmDuty(9, { duty: 0.5 })(trace, ctx).pass).toBe(false);
  });
});

describe('adcDerivedValue (semantic)', () => {
  it('decodes the number and compares to expected ± tolerance', () => {
    const trace = makeTrace({ serial: serialOf('TEMP_C=23.4\n') });
    const a = adcDerivedValue({ pattern: /TEMP_C=(-?\d+\.?\d*)/, expected: 23.4, tolerance: 0.2 });
    expect(a(trace, ctx).pass).toBe(true);
    const b = adcDerivedValue({ pattern: /TEMP_C=(-?\d+\.?\d*)/, expected: 30, tolerance: 0.2 });
    expect(b(trace, ctx).pass).toBe(false);
  });
  it('fails when nothing is captured', () => {
    const trace = makeTrace({ serial: serialOf('no number here') });
    expect(
      adcDerivedValue({ pattern: /=(\d+)/, expected: 1, tolerance: 0 })(trace, ctx).pass,
    ).toBe(false);
  });
});

describe('serialValue split (§6c)', () => {
  it('correct value + wrong format → semantic passes, format fails (0.7 majority)', () => {
    const trace = makeTrace({ serial: serialOf('Temp: 23.4 C\n') }); // right value, off format
    const [semantic, format] = serialValue({
      pattern: /(-?\d+\.\d+)/,
      expected: 23.4,
      tolerance: 0.2,
      formatRegex: /^TEMP_C=-?\d+\.\d+$/m,
    });
    const s = semantic(trace, ctx);
    const f = format(trace, ctx);
    expect(s.pass).toBe(true);
    expect(s.category).toBe('serial-value');
    expect(s.weight).toBeCloseTo(0.7);
    expect(f.pass).toBe(false);
    expect(f.weight).toBeCloseTo(0.3);
  });

  it('right format + wrong value → semantic fails (cannot pass on format alone)', () => {
    const trace = makeTrace({ serial: serialOf('TEMP_C=99.9\n') });
    const [semantic, format] = serialValue({
      pattern: /TEMP_C=(-?\d+\.\d+)/,
      expected: 23.4,
      tolerance: 0.2,
      formatRegex: /^TEMP_C=-?\d+\.\d+$/m,
    });
    expect(semantic(trace, ctx).pass).toBe(false);
    expect(format(trace, ctx).pass).toBe(true);
  });
});
