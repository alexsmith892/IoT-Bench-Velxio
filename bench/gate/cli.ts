/**
 * Gate CLI: `npm run gate <taskId>` (alias for `tsx gate/cli.ts <taskId>`).
 * Runs the capability gate (benchmark-design.md §5) for a task and writes a
 * `<taskId>-gate.json` artifact. Requires the Velxio backend (BENCH_API_BASE,
 * default http://127.0.0.1:8001).
 *
 * Exit code: 0 = GREEN, 1 = RED, 2 = usage/transport error.
 */
import { getTask, taskIds } from '../tasks/registry';
import { gate, formatGateReport } from './gate';
import { envBanner } from '../env';

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const id = args.find((a) => !a.startsWith('-'));
  const runsArg = args.find((a) => a.startsWith('--runs='));
  const runs = runsArg ? Number(runsArg.split('=')[1]) : undefined;

  if (!id) {
    console.error(`Usage: npm run gate <taskId> [--runs=N]\nAvailable: ${taskIds().join(', ')}`);
    return 2;
  }
  const task = getTask(id);
  if (!task) {
    console.error(`Unknown task "${id}". Available: ${taskIds().join(', ')}`);
    return 2;
  }

  try {
    console.log(envBanner());
    const report = await gate(task, { runs });
    console.log(formatGateReport(report));
    return report.pass ? 0 : 1;
  } catch (err) {
    console.error(`[gate ${id}] transport/runtime error: ${(err as Error).message}`);
    return 2;
  }
}

main().then((code) => process.exit(code));
