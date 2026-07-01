import { describe, it, expect } from 'vitest';
import { pulseWidth, servoAngle, edgeCount } from '../contracts/assertions';
import { serialBytesInclude } from '../contracts/dsl';
import { buildProject } from '../scenarios/uno-led-blink/circuit';
import type { Trace, PinEdge, SerialByte } from '../harness/trace';
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

/** A 50 Hz pulse train (period 20ms) with HIGH width `usHigh` µs, `n` pulses. */
function pulseTrain(pin: number, usHigh: number, n: number, periodMs = 20): PinEdge[] {
  const edges: PinEdge[] = [];
  const highMs = usHigh / 1000;
  for (let i = 0; i < n; i++) {
    const t0 = i * periodMs;
    edges.push({ tMs: t0, pin, value: 1 });
    edges.push({ tMs: t0 + highMs, pin, value: 0 });
  }
  return edges;
}

describe('pulseWidth', () => {
  it('decodes the mean HIGH width in µs within tolerance', () => {
    const trace = makeTrace({ pinEdges: pulseTrain(9, 1500, 5) });
    // reference: 1500µs pulse passes ±40µs
    expect(pulseWidth(9, { expectedUs: 1500 })(trace, ctx).pass).toBe(true);
    // wrong: an instant-jump/mis-mapped train at 2000µs fails a 1500µs target
    expect(pulseWidth(9, { expectedUs: 1500 })(makeTrace({ pinEdges: pulseTrain(9, 2000, 5) }), ctx).pass).toBe(false);
  });

  it('honours a measurement window (ignores pulses outside it)', () => {
    // first 3 pulses at 1000µs, then 3 at 2000µs
    const early = pulseTrain(9, 1000, 3);
    const late = pulseTrain(9, 2000, 3).map((e) => ({ ...e, tMs: e.tMs + 60 }));
    const trace = makeTrace({ pinEdges: [...early, ...late] });
    expect(pulseWidth(9, { expectedUs: 1000, window: { fromMs: 0, toMs: 55 } })(trace, ctx).pass).toBe(true);
    expect(pulseWidth(9, { expectedUs: 2000, window: { fromMs: 60, toMs: 130 } })(trace, ctx).pass).toBe(true);
  });

  it('fails closed with no complete HIGH pulse in the window', () => {
    const trace = makeTrace({ pinEdges: [{ tMs: 0, pin: 9, value: 1 }] });
    expect(pulseWidth(9, { expectedUs: 1500 })(trace, ctx).pass).toBe(false);
  });
});

describe('servoAngle', () => {
  it('maps 1000µs→0°, 1500µs→90°, 2000µs→180°', () => {
    expect(servoAngle(9, { angleDeg: 90 })(makeTrace({ pinEdges: pulseTrain(9, 1500, 4) }), ctx).pass).toBe(true);
    expect(servoAngle(9, { angleDeg: 0 })(makeTrace({ pinEdges: pulseTrain(9, 1000, 4) }), ctx).pass).toBe(true);
    expect(servoAngle(9, { angleDeg: 180 })(makeTrace({ pinEdges: pulseTrain(9, 2000, 4) }), ctx).pass).toBe(true);
    // wrong angle: a 90° (1500µs) train fails a 0° target
    expect(servoAngle(9, { angleDeg: 0 })(makeTrace({ pinEdges: pulseTrain(9, 1500, 4) }), ctx).pass).toBe(false);
  });
});

describe('edgeCount', () => {
  const edges: PinEdge[] = [
    { tMs: 5, pin: 4, value: 1 },
    { tMs: 15, pin: 4, value: 0 },
    { tMs: 25, pin: 4, value: 1 },
    { tMs: 35, pin: 4, value: 0 },
  ];
  it('bounds transitions in a window (no catch-up burst)', () => {
    const trace = makeTrace({ pinEdges: edges });
    expect(edgeCount(4, { max: 2, window: { fromMs: 0, toMs: 20 } })(trace, ctx).pass).toBe(true);
    // a burst wrong: 4 edges in a window capped at 2 fails
    expect(edgeCount(4, { max: 2, window: { fromMs: 0, toMs: 40 } })(trace, ctx).pass).toBe(false);
  });
  it('guards a stuck pin via min', () => {
    const trace = makeTrace({ pinEdges: edges });
    expect(edgeCount(4, { min: 2 })(trace, ctx).pass).toBe(true);
    expect(edgeCount(4, { min: 2 })(makeTrace({ pinEdges: [] }), ctx).pass).toBe(false);
  });
});

describe('serialBytesInclude', () => {
  const bytesOf = (arr: number[]): SerialByte[] =>
    arr.map((b, i) => ({ tMs: i, char: String.fromCharCode(b) }));
  it('matches an exact response frame as a byte subsequence', () => {
    // stream: garbage 0x00, then success frame 0x55 02 01 01 02
    const trace = makeTrace({ serial: bytesOf([0x00, 0x55, 0x02, 0x01, 0x01, 0x02]) });
    expect(serialBytesInclude([0x55, 0x02, 0x01, 0x01, 0x02])(trace, ctx).pass).toBe(true);
    // a checksum-ignoring wrong that never emits the NAK frame fails
    expect(serialBytesInclude([0x55, 0x02, 0x7f, 0x01, 0x2c])(trace, ctx).pass).toBe(false);
  });
});
