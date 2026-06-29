/**
 * Layer 3 — contract types. A Contract is a list of Assertions evaluated over a
 * Trace plus context. Each Assertion returns an explainable pass/fail so the
 * gating pipeline and fix-mode prompts can report *why* (doc 03 §B/§D).
 */
import type { Trace } from '../harness/trace';
import type { CircuitProject } from '../scenarios/types';

export interface AssertionResult {
  /** Stable label, e.g. "ledBlinks(bench_led)". */
  name: string;
  pass: boolean;
  /** Human-readable explanation of the verdict (shown in reports). */
  reason: string;
}

/** Context handed to every assertion — the circuit, so pins can be resolved. */
export interface AssertionContext {
  circuit: CircuitProject;
}

export type Assertion = (trace: Trace, ctx: AssertionContext) => AssertionResult;

export type Contract = Assertion[];
