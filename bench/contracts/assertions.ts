/**
 * Layer 3 — assertion builders. All are tolerance-bearing and Hz-agnostic:
 * they describe *behaviour* (frequency, duty, level-at-time), never hardcoded
 * pins or periods. `ledBlinks` resolves the pin from the circuit wiring so the
 * same contract works on any board/pin and inside multi-peripheral circuits.
 *
 * Tolerance note: avr8js is cycle-deterministic, so the only timing error is
 * `delay()` overhead. The 5% default is "safe but not generous" and can tighten
 * toward ~2% once observed on real reference solutions.
 */
import type { Trace } from "../harness/trace";
import { edgesForPin } from "../harness/trace";
import type { Assertion } from "./types";
import { resolveLedPin } from "./ledPinResolver";
import { analyzeDigitalTiming } from "../../shared/digitalTiming";
import { TOLERANCES } from "./policy";

const DEFAULT_TOL_PCT = TOLERANCES.freqPct;

const withinPct = (actual: number, expected: number, tolPct: number) =>
  Math.abs(actual - expected) <= (expected * tolPct) / 100;

const round = (x: number, dp = 3) => Math.round(x * 10 ** dp) / 10 ** dp;

// ── Pin-level primitives ────────────────────────────────────────────────────

/**
 * Optional measurement window [fromMs, toMs] — restrict the timing analysis to
 * edges inside it. Needed when a pin's frequency CHANGES over the run (e.g. a
 * mode-switching blinker), so whole-trace analysis would be meaningless.
 */
export interface TimingWindow {
  fromMs: number;
  toMs: number;
}

function windowedEdges(trace: Trace, pin: number, window?: TimingWindow) {
  const edges = edgesForPin(trace, pin);
  if (!window) return edges;
  return edges.filter((e) => e.tMs >= window.fromMs && e.tMs <= window.toMs);
}

export function pinFrequency(
  pin: number,
  opts: { hz: number; tolPct?: number; window?: TimingWindow },
): Assertion {
  const tolPct = opts.tolPct ?? DEFAULT_TOL_PCT;
  return (trace: Trace) => {
    const t = analyzeDigitalTiming(windowedEdges(trace, pin, opts.window));
    const win = opts.window ? `[${opts.window.fromMs}–${opts.window.toMs}ms]` : '';
    const name = `pinFrequency(${pin})${win}`;
    if (t.freqHz == null) {
      return {
        name,
        pass: false,
        category: "frequency",
        reason: `pin ${pin} never produced a full period (edges=${t.edgeCount}).`,
      };
    }
    const pass = withinPct(t.freqHz, opts.hz, tolPct);
    return {
      name,
      pass,
      category: "frequency",
      reason: `pin ${pin} freq=${round(t.freqHz, 4)}Hz vs ${opts.hz}Hz ±${tolPct}% → ${pass ? "ok" : "out of tolerance"}`,
    };
  };
}

export function pinDutyCycle(
  pin: number,
  opts: { duty: number; tolPct?: number; window?: TimingWindow },
): Assertion {
  const tolPct = opts.tolPct ?? DEFAULT_TOL_PCT;
  return (trace: Trace) => {
    const t = analyzeDigitalTiming(windowedEdges(trace, pin, opts.window));
    const win = opts.window ? `[${opts.window.fromMs}–${opts.window.toMs}ms]` : '';
    const name = `pinDutyCycle(${pin})${win}`;
    if (t.dutyMean == null) {
      return {
        name,
        pass: false,
        category: "duty",
        reason: `pin ${pin} has no complete high/low period.`,
      };
    }
    const pass = withinPct(t.dutyMean, opts.duty, tolPct);
    return {
      name,
      pass,
      category: "duty",
      reason: `pin ${pin} duty=${round(t.dutyMean)} vs ${opts.duty} ±${tolPct}% → ${pass ? "ok" : "out of tolerance"}`,
    };
  };
}

// ── Pulse-width / servo-angle (Pass 9) ────────────────────────────────────────

/**
 * Complete HIGH-pulse widths (ms) fully contained in `[fromMs, toMs]` — each
 * rising edge paired with the next falling edge, both inside the window. Used to
 * decode a servo/software pulse train's HIGH time (edge timestamps are sub-µs
 * floats, so µs-level widths are faithful).
 */
function highPulseWidthsMs(trace: Trace, pin: number, window?: TimingWindow): number[] {
  const edges = edgesForPin(trace, pin);
  const widths: number[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    if (edges[i].value !== 1 || edges[i + 1].value !== 0) continue;
    const rise = edges[i].tMs;
    const fall = edges[i + 1].tMs;
    if (window && (rise < window.fromMs || fall > window.toMs)) continue;
    widths.push(fall - rise);
  }
  return widths;
}

/**
 * Assert a periodic pulse train's mean HIGH width (in microseconds) is
 * `expectedUs` ± `tolUs` over an optional window. Reads `pinEdges` only — the
 * generic primitive `servoAngle` builds on. Fails closed if the window holds no
 * complete HIGH pulse (a stuck/absent train).
 */
export function pulseWidth(
  pin: number,
  opts: { expectedUs: number; tolUs?: number; window?: TimingWindow },
): Assertion {
  const tolUs = opts.tolUs ?? TOLERANCES.pulseWidthUs;
  return (trace: Trace) => {
    const win = opts.window ? `[${opts.window.fromMs}–${opts.window.toMs}ms]` : '';
    const name = `pulseWidth(${pin})${win}`;
    const widthsUs = highPulseWidthsMs(trace, pin, opts.window).map((ms) => ms * 1000);
    if (widthsUs.length === 0) {
      return {
        name,
        pass: false,
        category: 'pulse-width',
        reason: `pin ${pin} produced no complete HIGH pulse in the window.`,
      };
    }
    const actual = widthsUs.reduce((s, w) => s + w, 0) / widthsUs.length;
    const pass = Math.abs(actual - opts.expectedUs) <= tolUs;
    return {
      name,
      pass,
      category: 'pulse-width',
      reason: `pin ${pin} HIGH width=${round(actual, 1)}µs vs ${opts.expectedUs}µs ±${tolUs}µs (${widthsUs.length} pulse[s]) → ${pass ? 'ok' : 'out of tolerance'}`,
    };
  };
}

/**
 * Assert a servo pulse train encodes `angleDeg` (0–180°) — the °-native face of
 * `pulseWidth` for the standard 1000µs→0° / 2000µs→180° linear mapping. Tolerance
 * defaults to `servoAngleDeg` and is converted to µs internally.
 */
export function servoAngle(
  pin: number,
  opts: { angleDeg: number; tolDeg?: number; window?: TimingWindow },
): Assertion {
  const tolDeg = opts.tolDeg ?? TOLERANCES.servoAngleDeg;
  const expectedUs = 1000 + (opts.angleDeg / 180) * 1000;
  const tolUs = (tolDeg / 180) * 1000;
  const inner = pulseWidth(pin, { expectedUs, tolUs, window: opts.window });
  return (trace: Trace, ctx) => {
    const r = inner(trace, ctx);
    const win = opts.window ? `[${opts.window.fromMs}–${opts.window.toMs}ms]` : '';
    return {
      ...r,
      name: `servoAngle(${pin})${win}`,
      reason: `${r.reason} [target ${opts.angleDeg}° ±${tolDeg}° = ${round(expectedUs, 1)}µs]`,
    };
  };
}

// ── Edge count over a window (Pass 9) ─────────────────────────────────────────

/**
 * Assert the number of transitions on `pin` within an optional window is bounded
 * by `min`/`max`. Its Pass-9 use is "no catch-up edge burst" after a scheduler
 * RESUME (a phase-restart wrong emits an abnormal cluster of edges); it also
 * guards "stuck" (too few) pins. Category `edge-count`.
 */
export function edgeCount(
  pin: number,
  opts: { min?: number; max?: number; window?: TimingWindow },
): Assertion {
  return (trace: Trace) => {
    const win = opts.window ? `[${opts.window.fromMs}–${opts.window.toMs}ms]` : '';
    const name = `edgeCount(${pin})${win}`;
    const count = windowedEdges(trace, pin, opts.window).length;
    const minOk = opts.min == null || count >= opts.min;
    const maxOk = opts.max == null || count <= opts.max;
    const pass = minOk && maxOk;
    const bound = [
      opts.min != null ? `≥${opts.min}` : null,
      opts.max != null ? `≤${opts.max}` : null,
    ]
      .filter(Boolean)
      .join(' and ');
    return {
      name,
      pass,
      category: 'edge-count',
      reason: `pin ${pin} had ${count} edge(s) vs ${bound || 'any'} → ${pass ? 'ok' : 'out of bounds'}`,
    };
  };
}

export function pinIsHigh(pin: number, opts: { atMs: number }): Assertion {
  return (trace: Trace) => {
    const edges = edgesForPin(trace, pin).filter((e) => e.tMs <= opts.atMs);
    const level = edges.length ? edges[edges.length - 1].value : 0;
    const name = `pinIsHigh(${pin})@${opts.atMs}ms`;
    return {
      name,
      pass: level === 1,
      category: "pin-state",
      reason: `pin ${pin} was ${level ? "HIGH" : "LOW"} at ${opts.atMs}ms`,
    };
  };
}

// ── LED behaviour (composes the primitives via wire resolution) ─────────────

export interface LedBlinksOpts {
  /** LED component id in the circuit; its driving pin is resolved from wires. */
  component: string;
  /** Target blink frequency in Hz. */
  hz: number;
  /** Optional duty-cycle check (0..1). */
  dutyCycle?: number;
  /** Tolerance for both frequency and duty (default 5%). */
  tolPct?: number;
  /** Minimum number of full periods required (guards "stuck on/off"). Default 2. */
  minPeriods?: number;
}

/**
 * Assert an LED blinks at `hz` (and optionally a duty cycle). Board/pin-agnostic:
 * the driving pin is resolved from the circuit wiring. Fails closed on a stuck
 * pin via the `minPeriods` edge-count guard.
 */
export function ledBlinks(opts: LedBlinksOpts): Assertion {
  const tolPct = opts.tolPct ?? DEFAULT_TOL_PCT;
  const minPeriods = opts.minPeriods ?? 2;
  return (trace, ctx) => {
    const name = `ledBlinks(${opts.component})`;
    let pin: number;
    try {
      pin = resolveLedPin(ctx.circuit, opts.component);
    } catch (err) {
      return { name, pass: false, category: "frequency", reason: (err as Error).message };
    }

    const t = analyzeDigitalTiming(edgesForPin(trace, pin));
    if (t.periods.length < minPeriods || t.freqHz == null) {
      return {
        name,
        pass: false,
        category: "frequency",
        reason: `LED "${opts.component}" (pin ${pin}) produced ${t.periods.length} period(s) < ${minPeriods} required — likely stuck (edges=${t.edgeCount}).`,
      };
    }

    const freqOk = withinPct(t.freqHz, opts.hz, tolPct);
    const dutyOk =
      opts.dutyCycle == null ||
      (t.dutyMean != null && withinPct(t.dutyMean, opts.dutyCycle, tolPct));
    const pass = freqOk && dutyOk;

    const dutyPart =
      opts.dutyCycle == null
        ? ""
        : ` duty=${round(t.dutyMean ?? 0)} vs ${opts.dutyCycle}${dutyOk ? "" : " ✗"}`;
    return {
      name,
      pass,
      category: "frequency",
      reason: `LED "${opts.component}" on pin ${pin}: freq=${round(t.freqHz, 4)}Hz vs ${opts.hz}Hz ±${tolPct}%${freqOk ? "" : " ✗"}${dutyPart} → ${pass ? "PASS" : "FAIL"}`,
    };
  };
}
