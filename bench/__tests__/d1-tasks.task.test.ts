/**
 * Pass 6 — the five D1 tasks gate GREEN (benchmark-design.md §5). Live backend;
 * self-skips when it is unreachable. Each task: reference passes every variant,
 * deterministic across 3 fresh runs, and every adversarial-wrong fails on its
 * intended assertion category. Compile-bound and slow (~2–3 min) — run with the
 * `gate` script or in the background.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { gate } from '../gate/gate';
import activeLowInterlock from '../tasks/active-low-interlock/task';
import dualInputSafetyEnable from '../tasks/dual-input-safety-enable/task';
import tmp36CalibratedReport from '../tasks/tmp36-calibrated-report/task';
import potentiometerPwmMap from '../tasks/potentiometer-pwm-map/task';
import hexDipTo7Segment from '../tasks/hex-dip-to-7segment/task';
import type { OneShotScenario } from '../tasks/types';

const API_BASE = process.env.BENCH_API_BASE ?? 'http://127.0.0.1:8001';
async function backendUp(): Promise<boolean> {
  try {
    return (await fetch(`${API_BASE}/docs`)).ok;
  } catch {
    return false;
  }
}

const opts = { apiBase: API_BASE, noArtifact: true as const };

const D1_TASKS: OneShotScenario[] = [
  activeLowInterlock,
  dualInputSafetyEnable,
  tmp36CalibratedReport,
  potentiometerPwmMap,
  hexDipTo7Segment,
];

describe('D1 task bank gate (live backend)', () => {
  let up = false;
  beforeAll(async () => {
    up = await backendUp();
    if (!up) console.warn(`[gate] backend ${API_BASE} unreachable — skipping D1 gate.`);
  });

  for (const task of D1_TASKS) {
    it(`gates ${task.id} GREEN with every wrong attributed`, async (c) => {
      if (!up) return c.skip();
      const r = await gate(task, opts);
      expect(r.reference.compiled).toBe(true);
      expect(r.reference.passedAllVariants).toBe(true);
      expect(r.reference.deterministic).toBe(true);
      expect(r.wrongs.length).toBeGreaterThanOrEqual(2);
      expect(r.wrongs.every((w) => w.failedOnIntendedCategory)).toBe(true);
      expect(r.pass).toBe(true);
    }, 180_000);
  }
});
