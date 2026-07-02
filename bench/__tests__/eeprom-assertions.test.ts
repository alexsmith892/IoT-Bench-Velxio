import { describe, it, expect } from 'vitest';
import { eepromByte, eepromWriteCount } from '../contracts/dsl';
import type { Trace } from '../harness/trace';
import type { AssertionContext } from '../contracts/types';

const ctx = { circuit: { format: 'velxio-project', version: 1 } } as AssertionContext;

function traceWithEeprom(bytes: number[], writes: Trace['eepromWrites'] = []): Trace {
  return {
    pinEdges: [],
    serial: [],
    adcInputs: [],
    pwmSamples: [],
    serialInputs: [],
    durationMs: 1000,
    finalState: {},
    eepromSnapshot: Uint8Array.from(bytes),
    eepromWrites: writes,
  };
}

describe('eeprom assertions', () => {
  it('eepromByte passes on match and fails on mismatch', () => {
    const t = traceWithEeprom([0, 0xa5, 3]);
    expect(eepromByte(1, 0xa5)(t, ctx).pass).toBe(true);
    expect(eepromByte(2, 0xff)(t, ctx).pass).toBe(false);
  });

  it('eepromWriteCount passes within max and fails when over', () => {
    const writes = [
      { tMs: 100, addr: 0, value: 1 },
      { tMs: 200, addr: 1, value: 2 },
    ];
    const t = traceWithEeprom([0xff, 0xff], writes);
    expect(eepromWriteCount({ max: 2 })(t, ctx).pass).toBe(true);
    expect(eepromWriteCount({ max: 1 })(t, ctx).pass).toBe(false);
    expect(
      eepromWriteCount({ max: 1, window: { fromMs: 150, toMs: 250 } })(t, ctx).pass,
    ).toBe(true);
    expect(
      eepromWriteCount({ max: 0, window: { fromMs: 50, toMs: 150 } })(t, ctx).pass,
    ).toBe(false);
  });
});
