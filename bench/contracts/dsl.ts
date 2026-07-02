/**
 * Contract DSL expansion (Pass 3) — serial / PWM / value assertions plus the
 * value/format split (benchmark-design.md §4 DSL, §6c). Every builder is
 * tolerance-bearing and pulls its defaults from `policy.ts`; none hides a magic
 * number. Each result carries an `AssertionCategory` so the gate (Pass 4) can
 * verify an adversarial-wrong fails on its *intended* category.
 *
 * Split from `assertions.ts` (which holds the pin-timing/LED primitives) only to
 * keep each file focused; import from either.
 */
import type { Trace } from '../harness/trace';
import { edgesForPin, serialText, pwmSamplesForPin } from '../harness/trace';
import type { Assertion } from './types';
import { TOLERANCES, WEIGHTS } from './policy';

const round = (x: number, dp = 3) => Math.round(x * 10 ** dp) / 10 ** dp;

/** Serial-TX text restricted to bytes received at or before `tMs`. */
function serialTextUntil(trace: Trace, tMs: number): string {
  return trace.serial.filter((s) => s.tMs <= tMs).map((s) => s.char).join('');
}

/** Level a pin is at by time `tMs` (last edge ≤ t; default 0 = reset/input). */
function levelAt(trace: Trace, pin: number, tMs: number): 0 | 1 {
  const edges = edgesForPin(trace, pin).filter((e) => e.tMs <= tMs);
  return edges.length ? edges[edges.length - 1].value : 0;
}

// ── Serial ───────────────────────────────────────────────────────────────────

export interface SerialMatchOpts {
  /** Only consider serial received within the first `withinMs` of the run. */
  withinMs?: number;
  /**
   * Require the pattern to RECUR roughly once per `everyMs` (a periodic report).
   * Checked loosely: at least `floor(duration/everyMs) - 1` global matches.
   */
  everyMs?: number;
  /** Restrict matching to serial bytes in `[fromMs, toMs]` (inclusive). */
  window?: { fromMs: number; toMs: number };
}

/**
 * Assert the serial-TX stream matches `regex` (the literal-shape / FORMAT check
 * of the value/format split). Use a tolerance-bearing value assertion
 * (`adcDerivedValue` / `serialValue`) for the decoded number — never one regex
 * for both (§6c).
 */
export function serialMatches(regex: RegExp, opts: SerialMatchOpts = {}): Assertion {
  return (trace) => {
    const name = `serialMatches(${regex})`;
    let text: string;
    if (opts.window != null) {
      text = trace.serial
        .filter((s) => s.tMs >= opts.window!.fromMs && s.tMs <= opts.window!.toMs)
        .map((s) => s.char)
        .join('');
    } else {
      text = opts.withinMs != null ? serialTextUntil(trace, opts.withinMs) : serialText(trace);
    }

    if (opts.everyMs != null && opts.everyMs > 0) {
      const global = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
      const count = (text.match(global) ?? []).length;
      const expected = Math.max(1, Math.floor(trace.durationMs / opts.everyMs) - 1);
      const pass = count >= expected;
      return {
        name,
        pass,
        category: 'serial-format',
        reason: `serial matched ${count}× vs ≥${expected} expected (every ~${opts.everyMs}ms) → ${pass ? 'ok' : 'too few'}`,
      };
    }

    const pass = regex.test(text);
    const preview = text.length > 60 ? `${text.slice(0, 60)}…` : text;
    return {
      name,
      pass,
      category: 'serial-format',
      reason: `serial ${pass ? 'matched' : 'did NOT match'} ${regex} (text: ${JSON.stringify(preview)})`,
    };
  };
}

/**
 * Assert the serial-TX stream does NOT contain `regex` — the negative half of a
 * format check (e.g. "no FALSE_START was printed", "no STATE=DONE after an abort").
 * Category `serial-format`. Use it to prove a state that should NOT be reached
 * wasn't announced, so a wrong that over-emits is caught.
 */
export function serialAbsent(regex: RegExp, opts: { withinMs?: number } = {}): Assertion {
  return (trace) => {
    const text =
      opts.withinMs != null ? serialTextUntil(trace, opts.withinMs) : serialText(trace);
    const pass = !regex.test(text);
    return {
      name: `serialAbsent(${regex})`,
      pass,
      category: 'serial-format',
      reason: pass
        ? `serial never matched ${regex} (as required)`
        : `serial unexpectedly matched ${regex}`,
    };
  };
}

/**
 * Assert the serial-TX byte stream CONTAINS `bytes` as a contiguous subsequence —
 * the exact-byte face of `serialMatches` for binary protocols
 * (`binary_framed_protocol`), so a response frame is matched by value without
 * hand-escaping a Latin-1 regex. Category `serial-format`.
 */
export function serialBytesInclude(bytes: number[]): Assertion {
  return (trace) => {
    const stream = trace.serial.map((s) => s.char.charCodeAt(0) & 0xff);
    const needle = bytes.map((b) => b & 0xff);
    const hex = needle.map((b) => b.toString(16).padStart(2, '0')).join(' ');
    const name = `serialBytesInclude(${hex})`;
    let pass = needle.length === 0;
    for (let i = 0; i + needle.length <= stream.length && !pass; i++) {
      pass = needle.every((b, j) => stream[i + j] === b);
    }
    return {
      name,
      pass,
      category: 'serial-format',
      reason: pass
        ? `serial contained byte frame [${hex}]`
        : `serial did NOT contain byte frame [${hex}] (${stream.length} TX byte[s])`,
    };
  };
}

// ── Pin state over a window ───────────────────────────────────────────────────

export interface PinStateOpts {
  /** Check the level at this instant. */
  atMs?: number;
  /** Require the level to HOLD throughout [fromMs, toMs] (no opposite edge). */
  window?: { fromMs: number; toMs: number };
}

/**
 * Assert a pin equals `val` at an instant (`atMs`) or holds it across a window.
 * Generalises `pinIsHigh`. Window mode fails if any edge to the opposite level
 * occurs inside the window.
 */
export function pinState(pin: number, val: 0 | 1, opts: PinStateOpts): Assertion {
  return (trace) => {
    if (opts.window) {
      const { fromMs, toMs } = opts.window;
      const name = `pinState(${pin}=${val})[${fromMs}–${toMs}ms]`;
      const startOk = levelAt(trace, pin, fromMs) === val;
      const breach = edgesForPin(trace, pin).find(
        (e) => e.tMs > fromMs && e.tMs <= toMs && e.value !== val,
      );
      const pass = startOk && !breach;
      return {
        name,
        pass,
        category: 'pin-state',
        reason: pass
          ? `pin ${pin} held ${val ? 'HIGH' : 'LOW'} across ${fromMs}–${toMs}ms`
          : !startOk
            ? `pin ${pin} was ${val ? 'LOW' : 'HIGH'} at window start ${fromMs}ms`
            : `pin ${pin} changed off ${val} at ${round(breach!.tMs)}ms inside the window`,
      };
    }
    const atMs = opts.atMs ?? trace.durationMs;
    const level = levelAt(trace, pin, atMs);
    const name = `pinState(${pin}=${val})@${atMs}ms`;
    return {
      name,
      pass: level === val,
      category: 'pin-state',
      reason: `pin ${pin} was ${level ? 'HIGH' : 'LOW'} at ${atMs}ms (want ${val ? 'HIGH' : 'LOW'})`,
    };
  };
}

// ── Edge order ────────────────────────────────────────────────────────────────

export interface EdgeStep {
  pin: number;
  value: 0 | 1;
}

/**
 * Assert the given pin transitions occur IN ORDER (as a subsequence of the edge
 * stream — other edges may interleave). Optional `withinMs` bounds the time from
 * the first matched step to the last.
 */
export function edgeOrder(steps: EdgeStep[], opts: { withinMs?: number } = {}): Assertion {
  return (trace) => {
    const name = `edgeOrder(${steps.map((s) => `${s.pin}${s.value ? '↑' : '↓'}`).join('→')})`;
    const edges = [...trace.pinEdges].sort((a, b) => a.tMs - b.tMs);
    let i = 0;
    let firstT: number | null = null;
    let lastT = 0;
    for (const e of edges) {
      if (i >= steps.length) break;
      if (e.pin === steps[i].pin && e.value === steps[i].value) {
        if (firstT == null) firstT = e.tMs;
        lastT = e.tMs;
        i++;
      }
    }
    const ordered = i >= steps.length;
    const spanOk =
      opts.withinMs == null || (firstT != null && lastT - firstT <= opts.withinMs);
    const pass = ordered && spanOk;
    return {
      name,
      pass,
      category: 'edge-order',
      reason: ordered
        ? spanOk
          ? `all ${steps.length} transitions occurred in order${firstT != null ? ` (${round(lastT - firstT)}ms span)` : ''}`
          : `transitions ordered but span ${round(lastT - (firstT ?? 0))}ms > ${opts.withinMs}ms`
        : `only ${i}/${steps.length} transitions matched in order`,
    };
  };
}

// ── Hardware-PWM duty ─────────────────────────────────────────────────────────

/**
 * Assert a hardware-PWM pin settles at `duty` (0..1). Reads `trace.pwmSamples`
 * (OCR-derived). Tolerance is ABSOLUTE in duty units (`pwmDutyPct/100`) so it is
 * well-behaved near 0/1 where a percent band collapses. If the pin never PWM'd
 * (analogWrite(0)/(255) disconnect the compare output → constant GPIO), falls
 * back to the final driven level as duty 0 or 1.
 */
export function pwmDuty(pin: number, opts: { duty: number; tolPct?: number }): Assertion {
  const tol = (opts.tolPct ?? TOLERANCES.pwmDutyPct) / 100;
  return (trace) => {
    const name = `pwmDuty(${pin})`;
    const samples = pwmSamplesForPin(trace, pin);
    let actual: number;
    let src: string;
    if (samples.length > 0) {
      actual = samples[samples.length - 1].duty; // steady state
      src = `${samples.length} sample(s)`;
    } else {
      actual = levelAt(trace, pin, trace.durationMs); // constant GPIO fallback
      src = 'no PWM samples → final level';
    }
    const pass = Math.abs(actual - opts.duty) <= tol;
    return {
      name,
      pass,
      category: 'pwm-duty',
      reason: `pin ${pin} duty=${round(actual)} vs ${opts.duty} ±${tol} (${src}) → ${pass ? 'ok' : 'out of tolerance'}`,
    };
  };
}

// ── Decoded numeric value (the SEMANTIC half of the value/format split) ───────

export interface AdcDerivedValueOpts {
  /** Regex with ONE capture group around the number, e.g. /TEMP_C=(-?\d+\.?\d*)/. */
  pattern: RegExp;
  /** Expected value — the author derives this from the injected stimulus. */
  expected: number;
  /** Absolute tolerance on the decoded value. */
  tolerance: number;
  /** Optional transform applied to the parsed number before comparison. */
  transform?: (raw: number) => number;
  /** If several matches occur, which to grade ('last' default, or 'first'). */
  pick?: 'first' | 'last';
}

/**
 * Decode a number from the serial stream and compare it to `expected` ±
 * `tolerance`. Because `expected` is derived from the injected stimulus, a
 * solution that HARDCODES the string fails as soon as a variant changes the
 * input — the anti-gaming half of §6c. Pair with `serialMatches` (or use
 * `serialValue`) for the format half.
 */
export function adcDerivedValue(opts: AdcDerivedValueOpts): Assertion {
  return (trace) => {
    const name = `adcDerivedValue(${opts.pattern})`;
    const text = serialText(trace);
    const global = new RegExp(opts.pattern.source, opts.pattern.flags.includes('g') ? opts.pattern.flags : opts.pattern.flags + 'g');
    const matches = [...text.matchAll(global)].map((m) => m[1]).filter((g) => g != null);
    if (matches.length === 0) {
      return {
        name,
        pass: false,
        category: 'adc-value',
        reason: `no number captured by ${opts.pattern} in serial output`,
      };
    }
    const raw = Number(matches[opts.pick === 'first' ? 0 : matches.length - 1]);
    if (Number.isNaN(raw)) {
      return { name, pass: false, category: 'adc-value', reason: `captured "${matches[0]}" is not numeric` };
    }
    const actual = opts.transform ? opts.transform(raw) : raw;
    const pass = Math.abs(actual - opts.expected) <= opts.tolerance;
    return {
      name,
      pass,
      category: 'adc-value',
      reason: `decoded ${round(actual, 4)} vs ${opts.expected} ±${opts.tolerance} → ${pass ? 'ok' : 'out of tolerance'}`,
    };
  };
}

// ── EEPROM (Tier C, Pass 10) ──────────────────────────────────────────────────

/** Assert a byte in the final EEPROM snapshot matches `expected`. */
export function eepromByte(addr: number, expected: number): Assertion {
  return (trace) => {
    const name = `eepromByte(${addr},${expected})`;
    const snap = trace.eepromSnapshot;
    if (!snap) {
      return { name, pass: false, category: 'eeprom', reason: 'EEPROM snapshot unavailable on trace' };
    }
    const actual = snap[addr] ?? 0xff;
    const pass = actual === (expected & 0xff);
    return {
      name,
      pass,
      category: 'eeprom',
      reason: `EEPROM[${addr}]=0x${actual.toString(16)} vs 0x${(expected & 0xff).toString(16)} → ${pass ? 'ok' : 'mismatch'}`,
    };
  };
}

export interface EepromWriteCountOpts {
  /** Maximum firmware-initiated EEPROM writes allowed in the window. */
  max: number;
  /** Count only writes with tMs in `[fromMs, toMs]` (inclusive). */
  window?: { fromMs: number; toMs: number };
}

/**
 * Assert firmware-initiated EEPROM write count (stimulus seeds excluded).
 * Grades the "do not write EEPROM when unchanged" requirement.
 */
export function eepromWriteCount(opts: EepromWriteCountOpts): Assertion {
  return (trace) => {
    const name = `eepromWriteCount(max=${opts.max})`;
    const writes = trace.eepromWrites ?? [];
    const filtered =
      opts.window != null
        ? writes.filter((w) => w.tMs >= opts.window!.fromMs && w.tMs <= opts.window!.toMs)
        : writes;
    const count = filtered.length;
    const pass = count <= opts.max;
    const win =
      opts.window != null ? ` in [${opts.window.fromMs},${opts.window.toMs}]ms` : '';
    return {
      name,
      pass,
      category: 'eeprom-write',
      reason: `${count} EEPROM write(s)${win} vs ≤${opts.max} → ${pass ? 'ok' : 'too many'}`,
    };
  };
}

// ── Compile-size (the cross-cutting memory check, §7) ─────────────────────────

/**
 * Assert the compiled program fits in `maxBytes` of flash. Reads
 * `trace.compile.flashBytes` (attached by the runner from the compile step). The
 * near-budget variant gates one task per difficulty tier against an ATtiny85-tight
 * cap so memory frugality is a *behavioural* diagnostic, never a stated prompt
 * rule (benchmark-design.md §6e/§7). Fails closed if the size is unavailable.
 */
export function maxFlashBytes(maxBytes: number): Assertion {
  return (trace) => {
    const name = `maxFlashBytes(${maxBytes})`;
    const actual = trace.compile?.flashBytes;
    if (actual == null) {
      return { name, pass: false, category: 'compile-size', reason: 'compile flash size unavailable on the trace' };
    }
    const pass = actual <= maxBytes;
    return {
      name,
      pass,
      category: 'compile-size',
      reason: `flash=${actual}B vs ≤${maxBytes}B → ${pass ? 'ok' : 'over budget'}`,
    };
  };
}

/** Assert static global RAM fits in `maxBytes`. Reads `trace.compile.ramBytes`. */
export function maxRamBytes(maxBytes: number): Assertion {
  return (trace) => {
    const name = `maxRamBytes(${maxBytes})`;
    const actual = trace.compile?.ramBytes;
    if (actual == null) {
      return { name, pass: false, category: 'compile-size', reason: 'compile RAM size unavailable on the trace' };
    }
    const pass = actual <= maxBytes;
    return {
      name,
      pass,
      category: 'compile-size',
      reason: `ram=${actual}B vs ≤${maxBytes}B → ${pass ? 'ok' : 'over budget'}`,
    };
  };
}

// ── Value/format split (first-class, §6c) ─────────────────────────────────────

export interface SerialValueOpts {
  /** Capture-group regex for the SEMANTIC value. */
  pattern: RegExp;
  /** Expected value, derived from the injected stimulus. */
  expected: number;
  /** Absolute tolerance on the decoded value. */
  tolerance: number;
  /** Regex for the literal FORMAT/shape (no capture needed). */
  formatRegex: RegExp;
  /** Optional transform applied to the decoded value before comparison. */
  transform?: (raw: number) => number;
}

/**
 * The value/format split as a single call: returns TWO assertions — a
 * `serial-value` (semantic) one weighted `WEIGHTS.semantic` and a
 * `serial-format` one weighted `WEIGHTS.format`. Under partial credit a
 * correct-logic / wrong-format answer keeps the majority of the task, and a
 * right-format / wrong-logic answer cannot pass (§6c). Spread into a contract:
 * `contract: [...serialValue({...}), otherAssertion]`.
 */
export function serialValue(opts: SerialValueOpts): [Assertion, Assertion] {
  const semantic: Assertion = (trace, ctx) => {
    const r = adcDerivedValue({
      pattern: opts.pattern,
      expected: opts.expected,
      tolerance: opts.tolerance,
      transform: opts.transform,
    })(trace, ctx);
    return { ...r, category: 'serial-value', weight: WEIGHTS.semantic };
  };
  const format: Assertion = (trace, ctx) => {
    const r = serialMatches(opts.formatRegex)(trace, ctx);
    return { ...r, weight: WEIGHTS.format };
  };
  return [semantic, format];
}
