import { describe, it, expect } from 'vitest';
import { AVRHarness } from '../harness/AVRHarness';
import { runWithStimulus } from '../harness/stimulus';
import { eepromWritePollReadProgram, assemble, RJMP } from './helpers/avrMiniAsm';

function runEepromWrite(addr: number, value: number, budgetMs = 50): ReturnType<AVRHarness['trace']> {
  const h = new AVRHarness();
  h.loadProgram(eepromWritePollReadProgram(addr, value));
  runWithStimulus(h, budgetMs);
  return h.trace();
}

describe('AVRHarness EEPROM (Pass 10)', () => {
  it('round-trips a byte without hanging on EEPE poll', () => {
    const trace = runEepromWrite(0, 123, 80);
    expect(trace.eepromSnapshot?.[0]).toBe(123);
    expect((trace.eepromWrites ?? []).length).toBeGreaterThan(0);
  });

  it('eepromSeed pre-seeds without counting as firmware writes', () => {
    const h = new AVRHarness();
    h.loadProgram(assemble([RJMP(-1)])); // idle spin
    runWithStimulus(h, 5, [
      { kind: 'eepromSeed', tMs: 0, bytes: [{ addr: 5, value: 0xab }] },
    ]);
    const trace = h.trace();
    expect(trace.eepromSnapshot?.[5]).toBe(0xab);
    expect(trace.eepromWrites ?? []).toHaveLength(0);
  });

  it('reset stimulus preserves EEPROM across reboot with monotonic trace time', () => {
    const traces: string[] = [];
    for (let i = 0; i < 3; i++) {
      const h = new AVRHarness();
      h.loadProgram(eepromWritePollReadProgram(3, 0)); // idle loop
      runWithStimulus(h, 50, [
        { kind: 'eepromSeed', tMs: 0, bytes: [{ addr: 7, value: 42 }] },
        { kind: 'reset', tMs: 20 },
      ]);
      const trace = h.trace();
      expect(trace.eepromSnapshot?.[7]).toBe(42);
      expect(trace.simResets).toHaveLength(1);
      expect(trace.simResets![0].tMs).toBe(20);
      traces.push(JSON.stringify({ simResets: trace.simResets, snap7: trace.eepromSnapshot?.[7] }));
    }
    expect(traces[0]).toBe(traces[1]);
    expect(traces[1]).toBe(traces[2]);
  });

  it('records firmware EEPROM writes in the trace', () => {
    const trace = runEepromWrite(2, 42);
    expect(trace.eepromWrites?.some((w) => w.addr === 2)).toBe(true);
  });
});
