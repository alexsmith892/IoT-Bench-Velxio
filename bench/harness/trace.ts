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

export interface PwmSample {
  /** Simulated time the duty was sampled. */
  tMs: number;
  /** Arduino PWM pin (3, 5, 6, 9, 10, 11 on the Uno). */
  pin: number;
  /**
   * Duty cycle 0..1, derived from the OCR register / TOP (analogWrite range
   * 0..255). Recorded only when the compare output is connected and the duty
   * changes — see AVRHarness PWM sampler. NOT measured from pin edges: the
   * timer compare-output overrides the PORT bit the edge recorder reads.
   */
  duty: number;
}

export interface SerialInput {
  /** Simulated time the RX byte was injected. */
  tMs: number;
  /** The injected character (Latin-1). */
  char: string;
}

export interface Trace {
  /** Every digital pin transition, in chronological order. */
  pinEdges: PinEdge[];
  /** USART0 TX bytes (decoded as Latin-1 chars). */
  serial: SerialByte[];
  /** Echoed ADC stimulus — every voltage injected, in application order. */
  adcInputs: AdcInput[];
  /** Hardware-PWM duty samples (OCR-derived), in chronological order. */
  pwmSamples: PwmSample[];
  /** Echoed serial-RX stimulus — every byte injected, in application order. */
  serialInputs: SerialInput[];
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
  readonly pwmSamples: PwmSample[] = [];
  readonly serialInputs: SerialInput[] = [];

  recordPinEdge(tMs: number, pin: number, value: 0 | 1): void {
    this.pinEdges.push({ tMs, pin, value });
  }

  recordSerial(tMs: number, char: string): void {
    this.serial.push({ tMs, char });
  }

  recordAdcInput(tMs: number, channel: number, volts: number): void {
    this.adcInputs.push({ tMs, channel, volts });
  }

  recordPwmSample(tMs: number, pin: number, duty: number): void {
    this.pwmSamples.push({ tMs, pin, duty });
  }

  recordSerialInput(tMs: number, char: string): void {
    this.serialInputs.push({ tMs, char });
  }

  finish(durationMs: number, finalState: Record<string, unknown> = {}): Trace {
    return {
      pinEdges: this.pinEdges,
      serial: this.serial,
      adcInputs: this.adcInputs,
      pwmSamples: this.pwmSamples,
      serialInputs: this.serialInputs,
      durationMs,
      finalState,
    };
  }
}

/** Convenience: all edges recorded for one pin, chronological. */
export function edgesForPin(trace: Trace, pin: number): PinEdge[] {
  return trace.pinEdges.filter((e) => e.pin === pin);
}

/** Convenience: the full decoded serial-TX string. */
export function serialText(trace: Trace): string {
  return trace.serial.map((s) => s.char).join('');
}

/** Convenience: PWM samples for one pin, chronological. */
export function pwmSamplesForPin(trace: Trace, pin: number): PwmSample[] {
  return trace.pwmSamples.filter((s) => s.pin === pin);
}
