/**
 * CLI entry: `npm run task <taskId>` (alias for `tsx runner/cli.ts <taskId>`).
 * Compiles + grades the task's reference solution, prints a report, and writes
 * a JSON trace artifact to `bench/artifacts/` (disable with `--no-artifact`).
 * Requires the Velxio backend running (BENCH_API_BASE, default
 * http://127.0.0.1:8001).
 *
 * Exit code: 0 = PASS, 1 = FAIL/COMPILE_FAIL, 2 = usage/transport error.
 */
import { getTask, taskIds } from '../tasks/registry';
import { runTask, formatReport } from './runTask';
import { saveArtifact } from './artifact';
import { envBanner } from '../env';

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const writeArtifact = !args.includes('--no-artifact');
  const id = args.find((a) => !a.startsWith('-'));
  if (!id) {
    console.error(`Usage: npm run task <taskId> [--no-artifact]\nAvailable: ${taskIds().join(', ')}`);
    return 2;
  }
  const task = getTask(id);
  if (!task) {
    console.error(`Unknown task "${id}". Available: ${taskIds().join(', ')}`);
    return 2;
  }

  try {
    console.log(envBanner());
    const result = await runTask(task);
    console.log(formatReport(result));
    if (writeArtifact) {
      const path = saveArtifact(task, result, 'reference');
      console.log(`  artifact: ${path}`);
    }
    return result.pass ? 0 : 1;
  } catch (err) {
    console.error(`[${id}] transport/runtime error: ${(err as Error).message}`);
    return 2;
  }
}

main().then((code) => process.exit(code));
