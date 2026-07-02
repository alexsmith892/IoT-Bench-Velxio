/**
 * Stimulus injection (benchmark-notes one-shot-implementation-plan Pass 2).
 * Turns a task into a controllable closed loop: drive input pins and set ADC
 * voltages on a timed schedule, then run to a budget. Deterministic by design —
 * the reproducibility the whole benchmark rests on (benchmark-design.md §3.3).
 *
 * ── ms → cycle mapping ───────────────────────────────────────────────────────
 * Authors think in milliseconds. The harness runs at a fixed 16 MHz, so
 * 1 ms = 16 000 cycles. An event scheduled at `tMs` is applied at the first
 * instruction boundary at or after `round(tMs * 16000)` cycles — i.e. with
 * sub-microsecond (single-instruction) granularity. Grade behaviour over
 * tolerance windows, never at exact instruction latency.
 *
 * ── determinism / ordering ───────────────────────────────────────────────────
 * Events are applied in ascending `tMs`. Ties (same `tMs`) are broken by the
 * order they appear after expansion (a stable sequence number), so authoring
 * order fully determines the result and there is NO ambiguity. No wall-clock or
 * RAF pacing is involved.
 *
 * This module imports nothing from the harness: it drives any `StimulusTarget`
 * (AVRHarness implements it structurally), which keeps it board-agnostic and
 * unit-testable with a mock.
 */

/** The minimal harness surface the scheduler needs. */
export interface StimulusTarget {
  /** Advance simulated time to `ms` (monotonic; no-op if already past). */
  runUntilMs(ms: number): void;
  /** Drive the external level an INPUT pin reads (0/1). */
  setPin(pin: number, level: 0 | 1): void;
  /** Set an ADC channel voltage (echoed into the trace by the harness). */
  setAnalogVoltage(channel: number, volts: number): void;
  /** Deliver one RX byte to the firmware's serial input (0–255). Optional. */
  injectSerialByte?(byte: number): void;
  /** Pre-seed EEPROM cells (stimulus only; not counted as firmware writes). Optional. */
  seedEeprom?(bytes: Array<{ addr: number; value: number }>): void;
  /** Simulated MCU reset — CPU reboot, EEPROM preserved. Optional. */
  simulateReset?(): void;
}

/** Default serial baud assumed when a `serial` event omits one. */
export const DEFAULT_BAUD = 9600;

/**
 * Milliseconds to transmit one byte at `baud` (8N1 = 10 bits/byte). Used to
 * space the per-byte injections so each RX completes before the next arrives.
 */
export function byteTimeMs(baud: number): number {
  return (10 / baud) * 1000;
}

export type StimulusEvent =
  /** Drive input `pin` to `level` at `tMs` (e.g. a button press/release). */
  | { kind: 'pin'; tMs: number; pin: number; level: 0 | 1 }
  /** Step ADC `channel` to `volts` at `tMs`. */
  | { kind: 'adc'; tMs: number; channel: number; volts: number }
  /**
   * Linearly ramp ADC `channel` from `fromVolts` to `toVolts` over
   * `durationMs`, starting at `tMs`. Expanded to discrete `adc` steps at
   * `stepMs` cadence (default 10 ms), inclusive of both endpoints.
   */
  | {
      kind: 'adcRamp';
      tMs: number;
      channel: number;
      fromVolts: number;
      toVolts: number;
      durationMs: number;
      stepMs?: number;
    }
  /**
   * Inject a serial-RX string starting at `tMs`. Expanded to one per-byte
   * injection, spaced by the byte-time at `baud` (default 9600), so each byte's
   * RX completes before the next — the same expansion pattern as `adcRamp`.
   */
  | { kind: 'serial'; tMs: number; data: string; baud?: number }
  /**
   * Pre-seed EEPROM bytes at `tMs` (benchmark stimulus — not a firmware write).
   * Applied before the CPU runs past that time.
   */
  | { kind: 'eepromSeed'; tMs: number; bytes: Array<{ addr: number; value: number }> }
  /**
   * Simulated MCU reset at `tMs` — CPU reboots, EEPROM persists, trace continues
   * with monotonic timestamps (Tier C, Pass 10).
   */
  | { kind: 'reset'; tMs: number };

const DEFAULT_RAMP_STEP_MS = 10;

interface ResolvedStim {
  tMs: number;
  /** Stable tiebreak for equal `tMs` (expansion order). */
  seq: number;
  apply: (t: StimulusTarget) => void;
}

/**
 * Flatten events to a sorted, deterministic application list: `adcRamp` expands
 * to `adc` steps; everything is sorted by (tMs, seq). Exported for testing.
 */
export function resolveStimulus(events: readonly StimulusEvent[]): ResolvedStim[] {
  const out: ResolvedStim[] = [];
  let seq = 0;

  for (const ev of events) {
    if (ev.kind === 'pin') {
      const { pin, level } = ev;
      out.push({ tMs: ev.tMs, seq: seq++, apply: (t) => t.setPin(pin, level) });
    } else if (ev.kind === 'adc') {
      const { channel, volts } = ev;
      out.push({ tMs: ev.tMs, seq: seq++, apply: (t) => t.setAnalogVoltage(channel, volts) });
    } else if (ev.kind === 'serial') {
      const dt = byteTimeMs(ev.baud && ev.baud > 0 ? ev.baud : DEFAULT_BAUD);
      for (let i = 0; i < ev.data.length; i++) {
        const byte = ev.data.charCodeAt(i) & 0xff;
        out.push({
          tMs: ev.tMs + i * dt,
          seq: seq++,
          apply: (t) => t.injectSerialByte?.(byte),
        });
      }
    } else if (ev.kind === 'eepromSeed') {
      const bytes = ev.bytes;
      out.push({ tMs: ev.tMs, seq: seq++, apply: (t) => t.seedEeprom?.(bytes) });
    } else if (ev.kind === 'reset') {
      out.push({ tMs: ev.tMs, seq: seq++, apply: (t) => t.simulateReset?.() });
    } else {
      const step = ev.stepMs && ev.stepMs > 0 ? ev.stepMs : DEFAULT_RAMP_STEP_MS;
      const steps = Math.max(1, Math.ceil(ev.durationMs / step));
      for (let i = 0; i <= steps; i++) {
        const dt = Math.min(i * step, ev.durationMs);
        const frac = ev.durationMs > 0 ? dt / ev.durationMs : 1;
        const volts = ev.fromVolts + (ev.toVolts - ev.fromVolts) * frac;
        const channel = ev.channel;
        out.push({ tMs: ev.tMs + dt, seq: seq++, apply: (t) => t.setAnalogVoltage(channel, volts) });
      }
    }
  }

  return out.sort((a, b) => (a.tMs - b.tMs) || (a.seq - b.seq));
}

/**
 * Run `target` to `budgetMs`, applying each stimulus event at its scheduled
 * time. Events past the budget are ignored. The target must start fresh (one
 * harness instance per run = the reset-isolation boundary).
 */
export function runWithStimulus(
  target: StimulusTarget,
  budgetMs: number,
  events: readonly StimulusEvent[] = [],
): void {
  for (const ev of resolveStimulus(events)) {
    if (ev.tMs > budgetMs) break; // sorted → the rest are also past the budget
    target.runUntilMs(ev.tMs);
    ev.apply(target);
  }
  target.runUntilMs(budgetMs);
}
