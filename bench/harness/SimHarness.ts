import type { Trace } from './trace';

/**
 * Board-agnostic simulation harness interface. The AVR PoC implements it with
 * avr8js; the RP2040 expansion (benchmark-notes doc 03 §E) implements the same
 * shape over rp2040js with no contract changes. Stimulus hooks are optional so
 * a board only implements what it supports.
 */
export interface SimHarness {
  /** Clock frequency in Hz — used to convert cycles ↔ milliseconds. */
  readonly clockHz: number;

  /** Load an Intel HEX program image and bind a fresh CPU. */
  load(hexText: string): void;

  /** Run firmware until `ms` of simulated time has elapsed since reset. */
  runUntilMs(ms: number): void;

  /** Snapshot the accumulated trace. Call after `runUntilMs`. */
  trace(): Trace;

  /** Current digital level of a pin (0/1), reading the live port state. */
  getPin(pin: number): 0 | 1;

  /** Inject an analog voltage (0..clock-ref V) onto an ADC channel. Optional. */
  setAnalogVoltage?(channel: number, volts: number): void;
}
