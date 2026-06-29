/**
 * Trace-artifact persistence. Writes a self-contained JSON record of a run —
 * the full timestamped trace plus per-assertion verdicts — so checker changes
 * can be audited against past runs (benchmark-notes doc 03, Codex §: "record
 * trace artifacts for reference and wrong solutions"). Pure data, no secrets.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import type { BenchTask } from '../tasks/types';
import type { RunResult } from './runTask';

/** Default output dir: `bench/artifacts/` (gitignored). */
export const DEFAULT_ARTIFACT_DIR =
  process.env.BENCH_ARTIFACT_DIR ??
  resolve(dirname(fileURLToPath(import.meta.url)), '..', 'artifacts');

export interface TraceArtifact {
  taskId: string;
  /** Which firmware was graded, e.g. "reference" or "attempt". */
  label: string;
  board: string;
  runMs: number;
  verdict: RunResult['verdict'];
  pass: boolean;
  savedAt: string;
  results: RunResult['results'];
  compileStderr: string;
  trace: RunResult['trace'];
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]+/g, '_');
}

/** Build the artifact object (no I/O) — handy for tests. */
export function buildArtifact(task: BenchTask, result: RunResult, label = 'reference'): TraceArtifact {
  return {
    taskId: task.id,
    label,
    board: task.board,
    runMs: task.runMs,
    verdict: result.verdict,
    pass: result.pass,
    savedAt: new Date().toISOString(),
    results: result.results,
    compileStderr: result.compileStderr,
    trace: result.trace,
  };
}

/**
 * Write the artifact to `<dir>/<taskId>-<label>.json` and return the path.
 * Creates the directory if needed.
 */
export function saveArtifact(
  task: BenchTask,
  result: RunResult,
  label = 'reference',
  dir: string = DEFAULT_ARTIFACT_DIR,
): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${sanitize(task.id)}-${sanitize(label)}.json`);
  writeFileSync(path, JSON.stringify(buildArtifact(task, result, label), null, 2));
  return path;
}
