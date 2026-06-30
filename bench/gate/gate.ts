/**
 * Capability-gating pipeline (Pass 4) — the attempt-#1 fix
 * (benchmark-design.md §5). A task is admitted to the scored bank ONLY if:
 *
 *   1. the reference compiles and passes EVERY assertion in EVERY variant;
 *   2. every adversarial-wrong FAILS, and fails on its INTENDED assertion
 *      category (not an incidental failure) — the subtle bar (§5.2);
 *   3. the reference is stable across ≥3 fresh-instance runs (no state leakage),
 *      with variants run in randomized order each run (§5.3);
 *   4. artifacts are saved for later checker audits (§5.5).
 *
 * No task ships ungated. The gate consumes only Traces + verdicts; it never
 * inspects firmware source (that would be the over-specification trap, §6e).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from '../compile/compileClient';
import { gradeVariants, effectiveVariants, type VariantRunResult } from '../runner/variants';
import { DEFAULT_ARTIFACT_DIR } from '../runner/artifact';
import { PINNED_ENV } from '../env';
import type { Trace } from '../harness/trace';
import type { OneShotScenario, AdversarialWrong, OneShotVariant } from '../tasks/types';

export interface WrongGateResult {
  id: string;
  expectFailCategory: string;
  /** Did it fail overall (the minimum bar)? */
  failed: boolean;
  /** Did it fail ON its intended category (the real bar, §5.2)? */
  failedOnIntendedCategory: boolean;
  /** Was the intended category even present in the graded contract? */
  categoryPresent: boolean;
  reason: string;
}

export interface GateReport {
  taskId: string;
  pass: boolean;
  reasons: string[];
  /** Seed used to randomize variant order (recorded for reproducibility). */
  seed: number;
  runs: number;
  reference: {
    compiled: boolean;
    passedAllVariants: boolean;
    deterministic: boolean;
    /** Per-variant score from run 1 (all runs identical when deterministic). */
    variantScores: Record<string, number>;
  };
  wrongs: WrongGateResult[];
  env: typeof PINNED_ENV;
  savedAt: string;
}

export interface GateOptions {
  runs?: number;
  apiBase?: string;
  seed?: number;
  artifactDir?: string;
  /** Skip writing the artifact (tests). */
  noArtifact?: boolean;
  /**
   * Minimum hidden variants a task must carry to be admitted (benchmark-design.md
   * §7: "≥3 hidden variants"). Default 3. Lower it only during iteration. The
   * *differing-stimulus* quality is an authoring concern (Pass 6) — this is the
   * structural count check.
   */
  minVariants?: number;
  /** Minimum adversarial wrongs (benchmark-design.md §7: "≥2"). Default 2. */
  minWrongs?: number;
}

// ── deterministic shuffle (seeded) ────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(arr: readonly T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A stable, channel-only fingerprint of a Trace (excludes durationMs/finalState noise). */
function traceHash(t: Trace): string {
  return JSON.stringify({
    pinEdges: t.pinEdges,
    serial: t.serial,
    pwmSamples: t.pwmSamples,
    serialInputs: t.serialInputs,
    adcInputs: t.adcInputs,
  });
}

const categoriesFailed = (results: VariantRunResult['results']): Set<string> =>
  new Set(results.filter((r) => !r.pass).map((r) => r.category ?? 'custom'));

const categoriesPresent = (variants: VariantRunResult[]): Set<string> =>
  new Set(variants.flatMap((v) => v.results.map((r) => r.category ?? 'custom')));

/**
 * Run the full gate for one task. Returns a GateReport and (unless `noArtifact`)
 * writes it to `<artifactDir>/<taskId>-gate.json`.
 */
export async function gate(task: OneShotScenario, opts: GateOptions = {}): Promise<GateReport> {
  const runs = opts.runs ?? 3;
  const seed = opts.seed ?? 0xc0ffee;
  const minVariants = opts.minVariants ?? 3;
  const minWrongs = opts.minWrongs ?? 2;
  const reasons: string[] = [];
  const variants = effectiveVariants(task);

  // 0. Structural minimums (benchmark-design.md §7). Checked on the AUTHORED
  //    variants, not the implicit base — a task with no variants has 0, not 1.
  const authoredVariants = task.variants?.length ?? 0;
  if (authoredVariants < minVariants) {
    reasons.push(
      `only ${authoredVariants} hidden variant(s) — §7 requires ≥${minVariants} (differing stimulus).`,
    );
  }
  if (task.adversarialWrongs.length < minWrongs) {
    reasons.push(
      `only ${task.adversarialWrongs.length} adversarial wrong(s) — §7 requires ≥${minWrongs}.`,
    );
  }
  const structuralOk =
    authoredVariants >= minVariants && task.adversarialWrongs.length >= minWrongs;

  // 1. Compile + grade the reference across `runs` fresh instances, randomizing
  //    variant order each run to catch state leakage.
  const refCompiled = await compile(task.referenceFirmware, task.board, opts.apiBase);
  let referencePassedAll = false;
  let deterministic = false;
  const variantScores: Record<string, number> = {};

  if (!refCompiled.ok || !refCompiled.hex) {
    reasons.push(`reference did not compile: ${refCompiled.stderr.split('\n')[0] ?? ''}`);
  } else {
    const hashesByVariant = new Map<string, Set<string>>();
    let allRunsPass = true;
    const rng = mulberry32(seed);
    let firstRunByVariant: VariantRunResult[] = [];

    for (let run = 0; run < runs; run++) {
      const order: OneShotVariant[] = shuffled(variants, rng);
      const graded = gradeVariants(task, refCompiled.hex, order, {
        flashBytes: refCompiled.flashBytes,
        ramBytes: refCompiled.ramBytes,
      });
      for (const v of graded.variants) {
        if (!v.pass) allRunsPass = false;
        if (!hashesByVariant.has(v.variantId)) hashesByVariant.set(v.variantId, new Set());
        hashesByVariant.get(v.variantId)!.add(traceHash(v.trace));
      }
      if (run === 0) firstRunByVariant = graded.variants;
    }

    referencePassedAll = allRunsPass;
    if (!allRunsPass) {
      const failing = firstRunByVariant
        .filter((v) => !v.pass)
        .map((v) => `${v.variantId}: ${v.results.filter((r) => !r.pass).map((r) => r.name).join(', ')}`);
      reasons.push(`reference failed ${failing.length} variant(s): ${failing.join(' | ')}`);
    }

    deterministic = [...hashesByVariant.values()].every((set) => set.size === 1);
    if (!deterministic) {
      const unstable = [...hashesByVariant.entries()].filter(([, s]) => s.size > 1).map(([id]) => id);
      reasons.push(`reference NOT deterministic across ${runs} runs in variant(s): ${unstable.join(', ')}`);
    }

    for (const v of firstRunByVariant) variantScores[v.variantId] = v.score;
  }

  // 2. Each adversarial-wrong must FAIL on its intended category.
  const wrongs: WrongGateResult[] = [];
  for (const w of task.adversarialWrongs) {
    wrongs.push(await gateWrong(task, w, variants, opts));
  }

  const wrongsOk =
    task.adversarialWrongs.length > 0 && wrongs.every((w) => w.failedOnIntendedCategory);
  for (const w of wrongs.filter((w) => !w.failedOnIntendedCategory)) {
    reasons.push(`wrong "${w.id}": ${w.reason}`);
  }

  const pass = structuralOk && referencePassedAll && deterministic && wrongsOk;

  const report: GateReport = {
    taskId: task.id,
    pass,
    reasons,
    seed,
    runs,
    reference: { compiled: refCompiled.ok, passedAllVariants: referencePassedAll, deterministic, variantScores },
    wrongs,
    env: PINNED_ENV,
    savedAt: new Date().toISOString(),
  };

  if (!opts.noArtifact) {
    const dir = opts.artifactDir ?? DEFAULT_ARTIFACT_DIR;
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${task.id.replace(/[^\w-]+/g, '_')}-gate.json`), JSON.stringify(report, null, 2));
  }

  return report;
}

async function gateWrong(
  task: OneShotScenario,
  w: AdversarialWrong,
  variants: OneShotVariant[],
  opts: GateOptions,
): Promise<WrongGateResult> {
  if (!task.resolveFirmware) {
    return {
      id: w.id,
      expectFailCategory: w.expectFailCategory,
      failed: false,
      failedOnIntendedCategory: false,
      categoryPresent: false,
      reason: 'task has no resolveFirmware() to read the wrong sketch',
    };
  }
  const firmware = task.resolveFirmware(w.files);
  const compiled = await compile(firmware, task.board, opts.apiBase);
  if (!compiled.ok || !compiled.hex) {
    // A wrong that does not compile fails — but NOT on a behavioural category, so
    // it does not prove the contract discriminates. Treat as not-on-category.
    return {
      id: w.id,
      expectFailCategory: w.expectFailCategory,
      failed: true,
      failedOnIntendedCategory: false,
      categoryPresent: false,
      reason: `wrong did not compile (fails, but not on category "${w.expectFailCategory}")`,
    };
  }

  const graded = gradeVariants(task, compiled.hex, variants, {
    flashBytes: compiled.flashBytes,
    ramBytes: compiled.ramBytes,
  });
  const present = categoriesPresent(graded.variants).has(w.expectFailCategory);
  const failedOnCategory = graded.variants.some((v) =>
    categoriesFailed(v.results).has(w.expectFailCategory),
  );
  const failedOverall = graded.variants.some((v) => !v.pass);

  let reason: string;
  if (!failedOverall) {
    reason = `wrong PASSED all variants — the contract does not catch it`;
  } else if (!present) {
    reason = `intended category "${w.expectFailCategory}" is not in the contract`;
  } else if (!failedOnCategory) {
    const got = [...new Set(graded.variants.flatMap((v) => [...categoriesFailed(v.results)]))];
    reason = `failed, but on [${got.join(', ')}] not the intended "${w.expectFailCategory}" (incidental failure)`;
  } else {
    reason = `correctly fails on "${w.expectFailCategory}"`;
  }

  return {
    id: w.id,
    expectFailCategory: w.expectFailCategory,
    failed: failedOverall,
    failedOnIntendedCategory: failedOverall && present && failedOnCategory,
    categoryPresent: present,
    reason,
  };
}

/** Compact human-readable gate report for the CLI. */
export function formatGateReport(r: GateReport): string {
  const lines: string[] = [];
  lines.push(`[gate ${r.taskId}] ${r.pass ? 'GREEN ✅' : 'RED ❌'}  (seed ${r.seed}, ${r.runs} runs)`);
  lines.push(
    `  reference: compiled=${r.reference.compiled} passedAllVariants=${r.reference.passedAllVariants} deterministic=${r.reference.deterministic}`,
  );
  const scores = Object.entries(r.reference.variantScores).map(([k, v]) => `${k}=${v.toFixed(2)}`);
  if (scores.length) lines.push(`  variant scores: ${scores.join(' ')}`);
  for (const w of r.wrongs) {
    lines.push(`  wrong ${w.id} [${w.expectFailCategory}]: ${w.failedOnIntendedCategory ? '✓' : '✗'} ${w.reason}`);
  }
  for (const reason of r.reasons) lines.push(`  ✗ ${reason}`);
  return lines.join('\n');
}
