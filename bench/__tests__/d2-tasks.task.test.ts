/**
 * Pass 7 — the five D2 timing/analog/numeric tasks gate GREEN (benchmark-design.md
 * §5). Live backend; self-skips when unreachable. Each task: reference passes every
 * variant, deterministic across 3 fresh runs, and every adversarial-wrong fails on
 * its intended assertion category. In particular the scheduler's blocking-delay
 * wrong fails the pin-state (responsiveness) contract — the behavioral non-blocking
 * enforcer — and the accumulator's int16-sum wrong fails on the overflow variant.
 * Compile-bound and slow (~2–3 min) — run with the gate script or in the background.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { gate } from '../gate/gate';
import debouncedToggle from '../tasks/debounced-toggle/task';
import lightAlarmHysteresis from '../tasks/light-alarm-hysteresis/task';
import responsiveDualScheduler from '../tasks/responsive-dual-scheduler/task';
import rollingAdcAverage from '../tasks/rolling-adc-average/task';
import integerOverflowAccumulator from '../tasks/integer-overflow-accumulator/task';
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

const D2_TASKS: OneShotScenario[] = [
  debouncedToggle,
  lightAlarmHysteresis,
  responsiveDualScheduler,
  rollingAdcAverage,
  integerOverflowAccumulator,
];

describe('D2 task bank gate (live backend)', () => {
  let up = false;
  beforeAll(async () => {
    up = await backendUp();
    if (!up) console.warn(`[gate] backend ${API_BASE} unreachable — skipping D2 gate.`);
  });

  for (const task of D2_TASKS) {
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
