/**
 * Pass 8 — the four serial + early-FSM tasks gate GREEN (benchmark-design.md §5).
 * Live backend; self-skips when unreachable. Each: reference passes every variant,
 * deterministic across 3 fresh runs, every adversarial-wrong fails on its intended
 * category. Notable behavioral enforcers: serial_control_protocol's overlong-line
 * recovery variant; the reaction/appliance FSMs' abort/false-start deadlines fail a
 * blocking solution on `pin-state`. Compile-bound and slow — run in the background.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { gate } from '../gate/gate';
import serialControlProtocol from '../tasks/serial-control-protocol/task';
import fourModeIndicator from '../tasks/four-mode-indicator/task';
import reactionTimerFsm from '../tasks/reaction-timer-fsm/task';
import applianceCycleFsm from '../tasks/appliance-cycle-fsm/task';
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

const PASS8_TASKS: OneShotScenario[] = [
  serialControlProtocol,
  fourModeIndicator,
  reactionTimerFsm,
  applianceCycleFsm,
];

describe('Pass 8 task bank gate (live backend)', () => {
  let up = false;
  beforeAll(async () => {
    up = await backendUp();
    if (!up) console.warn(`[gate] backend ${API_BASE} unreachable — skipping Pass 8 gate.`);
  });

  for (const task of PASS8_TASKS) {
    it(`gates ${task.id} GREEN with every wrong attributed`, async (c) => {
      if (!up) return c.skip();
      const r = await gate(task, opts);
      expect(r.reference.compiled).toBe(true);
      expect(r.reference.passedAllVariants).toBe(true);
      expect(r.reference.deterministic).toBe(true);
      expect(r.wrongs.length).toBeGreaterThanOrEqual(2);
      expect(r.wrongs.every((w) => w.failedOnIntendedCategory)).toBe(true);
      expect(r.pass).toBe(true);
    }, 240_000);
  }
});
