/**
 * Variant runner (Pass 4). Runs one firmware across a task's hidden variants —
 * each a different stimulus timeline / contract over the SAME firmware
 * (benchmark-design.md §4) — compiling ONCE and simulating per variant on a
 * fresh harness. Produces per-variant results plus the partial-credit
 * `variantScore`s the gate and scorer consume.
 *
 * A task with no authored variants is run as a single implicit "base" variant
 * (base contract, no stimulus, `runMs` budget) so every task is uniformly a
 * list of variants.
 */
import { compile, type SketchFile, type CompileResult } from '../compile/compileClient';
import { simulateAndGrade } from './runTask';
import { variantScore } from './score';
import { resolveStimulus } from '../harness/stimulus';
import type { Trace, CompileMeta } from '../harness/trace';
import type { AssertionResult } from '../contracts/types';
import type { BenchTask, OneShotVariant } from '../tasks/types';

export interface VariantRunResult {
  variantId: string;
  description?: string;
  results: AssertionResult[];
  pass: boolean;
  score: number;
  trace: Trace;
}

export interface VariantsRunResult {
  taskId: string;
  /** False only on compile failure; check per-variant `pass`/`score` otherwise. */
  compiled: boolean;
  compileStderr: string;
  variants: VariantRunResult[];
  /** Mean of per-variant scores = the task_score (benchmark-design.md §6b). */
  taskScore: number;
  warnings: string[];
}

/** The implicit base variant used when a task authors none. */
export function baseVariant(): OneShotVariant {
  return { id: 'base' };
}

/** A task's variants, or the implicit base variant if it has none. */
export function effectiveVariants(task: BenchTask & { variants?: OneShotVariant[] }): OneShotVariant[] {
  return task.variants && task.variants.length > 0 ? task.variants : [baseVariant()];
}

/** Latest scheduled stimulus time (after ramp/serial expansion), or 0. */
function lastStimulusMs(variant: OneShotVariant): number {
  const resolved = resolveStimulus(variant.stimulus ?? []);
  return resolved.length ? resolved[resolved.length - 1].tMs : 0;
}

/**
 * Grade one already-compiled hex across the given variants (optionally reordered
 * by the caller for leakage detection). Each variant runs on a fresh harness.
 */
export function gradeVariants(
  task: BenchTask & { variants?: OneShotVariant[] },
  hex: string,
  variants: OneShotVariant[] = effectiveVariants(task),
  compileMeta?: CompileMeta,
): { variants: VariantRunResult[]; taskScore: number; warnings: string[] } {
  const warnings: string[] = [];
  const out: VariantRunResult[] = [];

  for (const v of variants) {
    const budgetMs = v.budgetMs ?? task.runMs;
    const lastMs = lastStimulusMs(v);
    if (lastMs > budgetMs) {
      warnings.push(
        `variant "${v.id}": stimulus extends to ${Math.round(lastMs)}ms past budget ${budgetMs}ms — ` +
          `events after the budget are dropped (Pass-2 reflection §4).`,
      );
    }
    const graded = simulateAndGrade(task, hex, {
      stimulus: v.stimulus,
      budgetMs,
      contract: v.contract,
      compileMeta,
    });
    out.push({
      variantId: v.id,
      description: v.description,
      results: graded.results,
      pass: graded.pass,
      score: variantScore(graded.results),
      trace: graded.trace,
    });
  }

  const taskScore = out.length ? out.reduce((s, v) => s + v.score, 0) / out.length : 0;
  return { variants: out, taskScore, warnings };
}

/**
 * Compile `firmware` once, then grade it across all the task's variants.
 * `firmware` defaults to the reference (gating); pass an LLM attempt to score it.
 */
export async function runVariants(
  task: BenchTask & { variants?: OneShotVariant[] },
  firmware: SketchFile[] = task.referenceFirmware,
  apiBase?: string,
): Promise<VariantsRunResult> {
  const compiled: CompileResult = await compile(firmware, task.board, apiBase);
  if (!compiled.ok || !compiled.hex) {
    return {
      taskId: task.id,
      compiled: false,
      compileStderr: compiled.stderr,
      variants: [],
      taskScore: 0,
      warnings: [],
    };
  }
  const graded = gradeVariants(task, compiled.hex, effectiveVariants(task), {
    flashBytes: compiled.flashBytes,
    ramBytes: compiled.ramBytes,
  });
  return {
    taskId: task.id,
    compiled: true,
    compileStderr: compiled.stderr,
    variants: graded.variants,
    taskScore: graded.taskScore,
    warnings: graded.warnings,
  };
}
