/**
 * Pass 4 — variant runner (live backend, self-skips when down). The reference
 * passes every variant; the task_score is the mean of per-variant partial-credit
 * scores; the hex is compiled once and reused across variants.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { runVariants, gradeVariants, effectiveVariants } from '../runner/variants';
import task from '../tasks/uno-led-blink/task';
import { compile } from '../compile/compileClient';

const API_BASE = process.env.BENCH_API_BASE ?? 'http://127.0.0.1:8001';
async function backendUp(): Promise<boolean> {
  try {
    return (await fetch(`${API_BASE}/docs`)).ok;
  } catch {
    return false;
  }
}

describe('variant runner (live backend)', () => {
  let up = false;
  beforeAll(async () => {
    up = await backendUp();
    if (!up) console.warn(`[variants] backend ${API_BASE} unreachable — skipping.`);
  });

  it('runs the reference across all 3 variants, all passing, taskScore 1', async (c) => {
    if (!up) return c.skip();
    const res = await runVariants(task, task.referenceFirmware, API_BASE);
    expect(res.compiled).toBe(true);
    expect(res.variants).toHaveLength(3);
    expect(res.variants.every((v) => v.pass)).toBe(true);
    expect(res.taskScore).toBeCloseTo(1, 5);
    expect(res.warnings).toEqual([]);
  }, 90_000);

  it('grades a wrong (2 Hz) below 1 across the variants', async (c) => {
    if (!up) return c.skip();
    const wrong = task.resolveFirmware!(['wrongs/blink-2hz.ino']);
    const res = await runVariants(task, wrong, API_BASE);
    expect(res.compiled).toBe(true);
    expect(res.variants.every((v) => !v.pass)).toBe(true);
    expect(res.taskScore).toBe(0);
  }, 90_000);

  it('warns when stimulus extends past the budget', async (c) => {
    if (!up) return c.skip();
    const compiled = await compile(task.referenceFirmware, task.board, API_BASE);
    expect(compiled.ok).toBe(true);
    // A variant whose stimulus is scheduled after its (small) budget.
    const graded = gradeVariants(task, compiled.hex!, [
      { id: 'past-budget', budgetMs: 100, stimulus: [{ kind: 'pin', tMs: 500, pin: 2, level: 0 }] },
    ]);
    expect(graded.warnings.length).toBeGreaterThan(0);
    expect(graded.warnings[0]).toMatch(/past budget/);
  }, 60_000);

  it('effectiveVariants falls back to a single base variant when none authored', () => {
    const bare = { ...task, variants: [] };
    expect(effectiveVariants(bare)).toHaveLength(1);
    expect(effectiveVariants(bare)[0].id).toBe('base');
  });
});
