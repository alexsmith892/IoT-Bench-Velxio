/**
 * Runner — wires the three layers for one task attempt (doc 03 §A):
 *   compile → simulate → grade → report.
 *
 * `firmware` defaults to the task's reference solution (used for gating); pass
 * an LLM's output here to grade an attempt.
 */
import { compile, type SketchFile } from '../compile/compileClient';
import { AVRHarness } from '../harness/AVRHarness';
import { traceDump } from '../harness/traceDump';
import { runWithStimulus, type StimulusEvent } from '../harness/stimulus';
import type { Trace } from '../harness/trace';
import type { AssertionResult, Contract } from '../contracts/types';
import type { BenchTask } from '../tasks/types';

export type Verdict = 'PASS' | 'FAIL' | 'COMPILE_FAIL';

export interface RunResult {
  taskId: string;
  verdict: Verdict;
  pass: boolean;
  results: AssertionResult[];
  trace: Trace | null;
  compileStderr: string;
}

/** One simulate+grade pass over an already-compiled hex (no recompile). */
export interface GradeOptions {
  /** Timed input stimulus (Pass 2). Defaults to none. */
  stimulus?: StimulusEvent[];
  /** Sim-time budget in ms. Defaults to the task's `runMs`. */
  budgetMs?: number;
  /** Contract to grade. Defaults to the task's base `contract`. */
  contract?: Contract;
}

export interface GradeResult {
  results: AssertionResult[];
  pass: boolean;
  trace: Trace;
}

/**
 * Simulate the compiled `hex` on a FRESH harness (the reset-isolation boundary)
 * with the given stimulus/budget, then grade it. Pulling compile out (it depends
 * only on the firmware, not the variant) lets the variant runner reuse one hex
 * across many variants.
 */
export function simulateAndGrade(task: BenchTask, hex: string, opts: GradeOptions = {}): GradeResult {
  const harness = new AVRHarness();
  harness.load(hex);
  runWithStimulus(harness, opts.budgetMs ?? task.runMs, opts.stimulus ?? []);
  const trace = harness.trace();
  const contract = opts.contract ?? task.contract;
  const results = contract.map((assertion) => assertion(trace, { circuit: task.circuit }));
  return { results, pass: results.every((r) => r.pass), trace };
}

export async function runTask(
  task: BenchTask,
  firmware: SketchFile[] = task.referenceFirmware,
  apiBase?: string,
): Promise<RunResult> {
  // 1. Compile.
  const compiled = await compile(firmware, task.board, apiBase);
  if (!compiled.ok || !compiled.hex) {
    return {
      taskId: task.id,
      verdict: 'COMPILE_FAIL',
      pass: false,
      results: [],
      trace: null,
      compileStderr: compiled.stderr,
    };
  }

  // 2 + 3. Simulate (base variant: no stimulus, base contract) and grade.
  const { results, pass, trace } = simulateAndGrade(task, compiled.hex);

  return {
    taskId: task.id,
    verdict: pass ? 'PASS' : 'FAIL',
    pass,
    results,
    trace,
    compileStderr: compiled.stderr,
  };
}

/** Compact, human-readable report (doc 03 Codex note: dump traces early). */
export function formatReport(result: RunResult): string {
  const lines: string[] = [];
  lines.push(`[${result.taskId}] ${result.verdict}`);

  if (result.verdict === 'COMPILE_FAIL') {
    lines.push('  compile failed:');
    lines.push(
      result.compileStderr
        .split('\n')
        .map((l) => `    ${l}`)
        .join('\n'),
    );
    return lines.join('\n');
  }

  if (result.trace) {
    lines.push(
      traceDump(result.trace)
        .split('\n')
        .map((l) => `  ${l}`)
        .join('\n'),
    );
  }

  for (const r of result.results) {
    lines.push(`  ${r.pass ? '✓' : '✗'} ${r.reason}`);
  }
  return lines.join('\n');
}
