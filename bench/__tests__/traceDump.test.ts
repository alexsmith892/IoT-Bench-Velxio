import { describe, it, expect } from 'vitest';
import { traceDump } from '../harness/traceDump';
import type { Trace } from '../harness/trace';

const trace: Trace = {
  pinEdges: [
    { tMs: 0, pin: 13, value: 1 },
    { tMs: 500, pin: 13, value: 0 },
    { tMs: 1000, pin: 13, value: 1 },
    { tMs: 0, pin: 3, value: 1 },
  ],
  serial: [
    { tMs: 10, char: 'A' },
    { tMs: 11, char: 'V' },
    { tMs: 12, char: 'G' },
    { tMs: 13, char: '=' },
    { tMs: 14, char: '5' },
    { tMs: 15, char: '\n' },
  ],
  adcInputs: [
    { tMs: 0, channel: 0, volts: 0 },
    { tMs: 100, channel: 0, volts: 2.5 },
    { tMs: 200, channel: 0, volts: 5 },
  ],
  pwmSamples: [
    { tMs: 0, pin: 9, duty: 0 },
    { tMs: 500, pin: 9, duty: 0.5 },
  ],
  serialInputs: [
    { tMs: 5, char: 'O' },
    { tMs: 6, char: 'N' },
  ],
  durationMs: 3000,
  finalState: { halt: 'budget' },
};

describe('traceDump', () => {
  it('summarises duration, halt, per-pin edges and serial text', () => {
    const out = traceDump(trace);
    expect(out).toContain('trace 3000ms');
    expect(out).toContain('halt: budget');
    // Pins are grouped, ascending; pin 13 has 3 edges with arrows + timestamps.
    expect(out).toContain('pin  3:');
    expect(out).toContain('pin 13:');
    expect(out).toContain('↑0ms');
    expect(out).toContain('↓500ms');
    expect(out).toContain('[3 edges]');
    // Serial text with the newline escaped, plus a byte count.
    expect(out).toContain('AVG=5\\n');
    expect(out).toContain('[6 bytes]');
    // Echoed ADC stimulus, summarised per channel.
    expect(out).toContain('adc ch0: 0.00→5.00V [3 pts]');
    // Hardware-PWM duty samples and echoed serial-RX.
    expect(out).toContain('pwm  9: duty 0.00→0.50 [2 samples]');
    expect(out).toContain('serial-rx: "ON" [2 bytes]');
  });

  it('clips long edge lists and reports the overflow count', () => {
    const many: Trace = {
      pinEdges: Array.from({ length: 40 }, (_, i) => ({
        tMs: i * 10,
        pin: 5,
        value: (i % 2) as 0 | 1,
      })),
      serial: [],
      adcInputs: [],
      pwmSamples: [],
      serialInputs: [],
      durationMs: 400,
      finalState: {},
    };
    const out = traceDump(many);
    expect(out).toContain('…(+24)'); // 40 - 16 shown
    expect(out).toContain('[40 edges]');
  });

  it('handles an empty trace without throwing', () => {
    const out = traceDump({ pinEdges: [], serial: [], adcInputs: [], pwmSamples: [], serialInputs: [], durationMs: 0, finalState: {} });
    expect(out).toContain('trace 0ms');
    expect(out).toContain('(no edges)');
    expect(out).toContain('serial: (none)');
  });
});
