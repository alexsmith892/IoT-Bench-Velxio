/**
 * Partial-credit scoring (Pass 3, benchmark-design.md §6b/§6c). The headline is
 * ONE unweighted macro-average of per-task partial credit — no mode×level
 * matrix, no arbitrary task weights:
 *
 *   variant_score = Σ(weight of passed assertions) / Σ(weight of all assertions)
 *   task_score    = mean(variant_score) over the task's variants
 *   HEADLINE      = mean(task_score)     over all scored tasks
 *
 * `variant_score` is a *weighted* fraction so the value/format split (§6c) can
 * make the semantic assertion worth more than the format one. With the default
 * weight of 1 on every assertion this reduces EXACTLY to the simple
 * passed/required count fraction of §6b (e.g. 5 of 6 → 0.8333…).
 *
 * The strict score (all-assertions-pass-in-all-variants ? 1 : 0) is reported
 * alongside as a diagnostic, never folded into the headline.
 */
import type { AssertionResult } from '../contracts/types';
import { WEIGHTS } from '../contracts/policy';

const weightOf = (r: AssertionResult): number => r.weight ?? WEIGHTS.default;

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Weighted fraction of assertions that passed in one variant. Returns 0 for an
 * empty contract (nothing demonstrated). NaN-safe: equal weights → count
 * fraction.
 */
export function variantScore(results: AssertionResult[]): number {
  const total = results.reduce((s, r) => s + weightOf(r), 0);
  if (total === 0) return 0;
  const passed = results.reduce((s, r) => s + (r.pass ? weightOf(r) : 0), 0);
  return passed / total;
}

/** Mean of a task's per-variant scores. */
export function taskScore(variantScores: number[]): number {
  return mean(variantScores);
}

/** Unweighted macro-average over tasks — the headline number. */
export function headline(taskScores: number[]): number {
  return mean(taskScores);
}

/** Strict variant verdict: every assertion passed. */
export function variantStrict(results: AssertionResult[]): boolean {
  return results.length > 0 && results.every((r) => r.pass);
}

/** Strict task score: 1 iff every variant passed strictly, else 0. */
export function taskStrict(variantResults: AssertionResult[][]): 0 | 1 {
  return variantResults.length > 0 && variantResults.every(variantStrict) ? 1 : 0;
}
