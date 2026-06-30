/**
 * Trace — the structured, serialisable record a SimHarness produces while
 * running firmware. Grading (the contract matcher) consumes ONLY a Trace plus
 * compile metadata; it never reaches back into the simulator. That separation
 * is what lets a future RP2040 / QEMU harness reuse the same contracts
 * (benchmark-notes doc 03 §B/§E).
 *
 * Channels are intentionally minimal for the L1 PoC (pin edges + serial); the
 * shape leaves room for the pwm/adc/bus channels doc 03 sketches.
 */

export interface PinEdge {
  /** Simulated time in milliseconds since reset. */
  tMs: number;
  /** Arduino pin number (board-relative; the resolver maps LEDs → pins). */
  pin: number;
  /** Logic level the pin transitioned TO. */
  value: 0 | 1;
}

export interface SerialByte {
  tMs: number;
  char: string;
}

export interface AdcInput {
  /** Simulated time the channel voltage was set. */
  tMs: number;
  /** ADC channel (0 = A0). */
  channel: number;
  /** Volts applied (clamped to the ADC range when set). */
  volts: number;
}

export interface Trace {
  /** Every digital pin transition, in chronological order. */
  pinEdges: PinEdge[];
  /** USART0 TX bytes (decoded as Latin-1 chars). */
  serial: SerialByte[];
  /** Echoed ADC stimulus — every voltage injected, in application order. */
  adcInputs: AdcInput[];
  /** Total simulated milliseconds the trace covers. */
  durationMs: number;
  /** Free-form end-of-run snapshot (final pin levels, halt reason, …). */
  finalState: Record<string, unknown>;
}

/**
 * Accumulates a Trace as the harness runs. The harness supplies the current
 * simulated time (derived from `cpu.cycles`) on every event so the recorder
 * stays MCU-agnostic.
 */
export class TraceRecorder {
  readonly pinEdges: PinEdge[] = [];
  readonly serial: SerialByte[] = [];
  readonly adcInputs: AdcInput[] = [];

  recordPinEdge(tMs: number, pin: number, value: 0 | 1): void {
    this.pinEdges.push({ tMs, pin, value });
  }

  recordSerial(tMs: number, char: string): void {
    this.serial.push({ tMs, char });
  }

  recordAdcInput(tMs: number, channel: number, volts: number): void {
    this.adcInputs.push({ tMs, channel, volts });
  }

  finish(durationMs: number, finalState: Record<string, unknown> = {}): Trace {
    return {
      pinEdges: this.pinEdges,
      serial: this.serial,
      adcInputs: this.adcInputs,
      durationMs,
      finalState,
    };
  }
}

/** Convenience: all edges recorded for one pin, chronological. */
export function edgesForPin(trace: Trace, pin: number): PinEdge[] {
  return trace.pinEdges.filter((e) => e.pin === pin);
}

/** Convenience: the full decoded serial string. */
export function serialText(trace: Trace): string {
  return trace.serial.map((s) => s.char).join('');
}
