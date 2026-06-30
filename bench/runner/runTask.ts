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
import type { Trace } from '../harness/trace';
import type { AssertionResult } from '../contracts/types';
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

  // 2. Simulate.
  const harness = new AVRHarness();
  harness.load(compiled.hex);
  harness.runUntilMs(task.runMs);
  const trace = harness.trace();

  // 3. Grade.
  const results = task.contract.map((assertion) => assertion(trace, { circuit: task.circuit }));
  const pass = results.every((r) => r.pass);

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
