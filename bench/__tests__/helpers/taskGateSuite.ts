/**
 * Standard capability-gate tests shared by every scored task
 * (benchmark-design.md §5). Each per-task folder calls
 * `registerStandardTaskGateTests(task)` to run the same bar the old
 * d1/d2/pass8 batch files applied in a loop.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { gate } from '../../gate/gate';
import type { OneShotScenario } from '../../tasks/types';
import { API_BASE, backendUp, defaultGateOpts } from './liveBackend';

const LONG_GATE_TIMEOUT_MS = 240_000;
const DEFAULT_GATE_TIMEOUT_MS = 180_000;

const LONG_GATE_TASK_IDS = new Set([
  'serial-control-protocol',
  'four-mode-indicator',
  'reaction-timer-fsm',
  'appliance-cycle-fsm',
]);

export interface TaskGateSuiteOptions {
  timeoutMs?: number;
}

function defaultTimeoutFor(taskId: string): number {
  return LONG_GATE_TASK_IDS.has(taskId) ? LONG_GATE_TIMEOUT_MS : DEFAULT_GATE_TIMEOUT_MS;
}

/** Offline manifest — lists what the gate exercises without a live backend. */
function registerTaskManifestTests(task: OneShotScenario): void {
  describe(`${task.id} manifest`, () => {
    it('reports difficulty, domain, and harness tiers', () => {
      expect(task.difficulty).toMatch(/^D[1-4]$/);
      expect(typeof task.domain).toBe('string');
      expect(task.domain.length).toBeGreaterThan(0);
      expect(task.tiers.length).toBeGreaterThan(0);
    });

    it('carries at least 3 hidden variants and 2 adversarial wrongs (§7)', () => {
      expect(task.variants.length).toBeGreaterThanOrEqual(3);
      expect(task.adversarialWrongs.length).toBeGreaterThanOrEqual(2);
    });

    it('lists variant ids and wrong ids with intended failure categories', () => {
      const variantIds = task.variants.map((v) => v.id);
      expect(variantIds.length).toBe(new Set(variantIds).size);
      for (const w of task.adversarialWrongs) {
        expect(w.id.length).toBeGreaterThan(0);
        expect(w.expectFailCategory.length).toBeGreaterThan(0);
        expect(w.files.length).toBeGreaterThan(0);
      }
    });
  });
}

/** Live gate — reference GREEN, every wrong attributed; self-skips when backend is down. */
function registerTaskGateTests(task: OneShotScenario, timeoutMs: number): void {
  describe(`gate: ${task.id} (live backend)`, () => {
    let up = false;
    beforeAll(async () => {
      up = await backendUp();
      if (!up) console.warn(`[gate] backend ${API_BASE} unreachable — skipping ${task.id}.`);
    });

    it(`gates ${task.id} GREEN with every wrong attributed`, async (c) => {
      if (!up) return c.skip();
      const r = await gate(task, defaultGateOpts);
      expect(r.reference.compiled).toBe(true);
      expect(r.reference.passedAllVariants).toBe(true);
      expect(r.reference.deterministic).toBe(true);
      expect(r.wrongs.length).toBeGreaterThanOrEqual(2);
      expect(r.wrongs.every((w) => w.failedOnIntendedCategory)).toBe(true);
      expect(r.pass).toBe(true);
    }, timeoutMs);
  });
}

export function registerStandardTaskGateTests(
  task: OneShotScenario,
  opts: TaskGateSuiteOptions = {},
): void {
  const timeoutMs = opts.timeoutMs ?? defaultTimeoutFor(task.id);
  registerTaskManifestTests(task);
  registerTaskGateTests(task, timeoutMs);
}
