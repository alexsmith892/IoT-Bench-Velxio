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

export function pinFrequency(
  pin: number,
  opts: { hz: number; tolPct?: number },
): Assertion {
  const tolPct = opts.tolPct ?? DEFAULT_TOL_PCT;
  return (trace: Trace) => {
    const t = analyzeDigitalTiming(edgesForPin(trace, pin));
    const name = `pinFrequency(${pin})`;
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
  opts: { duty: number; tolPct?: number },
): Assertion {
  const tolPct = opts.tolPct ?? DEFAULT_TOL_PCT;
  return (trace: Trace) => {
    const t = analyzeDigitalTiming(edgesForPin(trace, pin));
    const name = `pinDutyCycle(${pin})`;
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
