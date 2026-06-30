/**
 * Layer 3 — contract types. A Contract is a list of Assertions evaluated over a
 * Trace plus context. Each Assertion returns an explainable pass/fail so the
 * gating pipeline and fix-mode prompts can report *why* (doc 03 §B/§D).
 */
import type { Trace } from '../harness/trace';
import type { CircuitProject } from '../scenarios/types';

/**
 * Coarse behaviour class an assertion checks. Used by the gate (Pass 4) to
 * verify each adversarial-wrong fails on its *intended* category, and by the
 * value/format split (§6c) to weight semantic vs format. `custom` is the
 * default for legacy/escape-hatch assertions.
 */
export type AssertionCategory =
  | 'frequency'
  | 'duty'
  | 'pwm-duty'
  | 'pin-state'
  | 'edge-order'
  | 'serial-format'
  | 'serial-value'
  | 'adc-value'
  | 'compile-size'
  | 'custom';

export interface AssertionResult {
  /** Stable label, e.g. "ledBlinks(bench_led)". */
  name: string;
  pass: boolean;
  /** Human-readable explanation of the verdict (shown in reports). */
  reason: string;
  /**
   * Behaviour class (Pass 3). Optional for back-compat; scoring/gating default
   * a missing value to `custom`. New assertions always set it.
   */
  category?: AssertionCategory;
  /**
   * Relative weight in partial-credit scoring (Pass 3). Optional; a missing
   * value scores as 1 (so an all-equal-weight contract reduces to the simple
   * passed/required fraction in benchmark-design.md §6b).
   */
  weight?: number;
}

/** Context handed to every assertion — the circuit, so pins can be resolved. */
export interface AssertionContext {
  circuit: CircuitProject;
}

export type Assertion = (trace: Trace, ctx: AssertionContext) => AssertionResult;

export type Contract = Assertion[];
