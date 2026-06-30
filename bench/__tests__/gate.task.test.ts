/**
 * Pass 4 — capability gate (live backend, self-skips when down). Verifies the
 * benchmark-design.md §5 contract on the worked-example task:
 *   - uno-led-blink gates GREEN (reference passes all variants, both wrongs fail
 *     on the intended frequency category, deterministic across 3 runs);
 *   - flipping the reference to the 2 Hz sketch makes the gate RED, naming the
 *     frequency failure;
 *   - a wrong whose declared category does not match its actual failure is NOT
 *     credited (incidental failure ≠ intended failure).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { gate } from '../gate/gate';
import baseTask from '../tasks/uno-led-blink/task';
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

describe('capability gate (live backend)', () => {
  let up = false;
  beforeAll(async () => {
    up = await backendUp();
    if (!up) console.warn(`[gate] backend ${API_BASE} unreachable — skipping.`);
  });

  it('gates uno-led-blink GREEN with both wrongs attributed to frequency', async (c) => {
    if (!up) return c.skip();
    const r = await gate(baseTask, opts);
    expect(r.pass).toBe(true);
    expect(r.reference.passedAllVariants).toBe(true);
    expect(r.reference.deterministic).toBe(true);
    expect(r.wrongs).toHaveLength(2);
    expect(r.wrongs.every((w) => w.failedOnIntendedCategory)).toBe(true);
    expect(r.wrongs.every((w) => w.expectFailCategory === 'frequency')).toBe(true);
  }, 120_000);

  it('goes RED when the reference is flipped to the 2 Hz sketch', async (c) => {
    if (!up) return c.skip();
    const twoHz: OneShotScenario = {
      ...baseTask,
      referenceFirmware: baseTask.resolveFirmware!(['wrongs/blink-2hz.ino']),
    };
    const r = await gate(twoHz, opts);
    expect(r.pass).toBe(false);
    expect(r.reference.passedAllVariants).toBe(false);
    // The failure names the frequency contract (ledBlinks is the frequency check).
    expect(r.reasons.join(' ')).toMatch(/ledBlinks|frequency/i);
  }, 120_000);

  it('goes RED when a task carries fewer than 3 hidden variants (§7)', async (c) => {
    if (!up) return c.skip();
    const tooFew: OneShotScenario = { ...baseTask, variants: baseTask.variants.slice(0, 2) };
    const r = await gate(tooFew, opts);
    expect(r.pass).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/hidden variant|§7/);
  }, 120_000);

  it('does NOT credit a wrong that fails on the wrong (incidental) category', async (c) => {
    if (!up) return c.skip();
    // Declare the stuck-on wrong should fail on "duty" — but it actually fails on
    // "frequency" (the minPeriods guard). The gate must flag the mismatch.
    const mislabeled: OneShotScenario = {
      ...baseTask,
      adversarialWrongs: [
        { id: 'stuck-mislabeled', files: ['wrongs/blink-stuck-on.ino'], expectFailCategory: 'duty' },
      ],
    };
    const r = await gate(mislabeled, opts);
    expect(r.pass).toBe(false);
    const w = r.wrongs.find((w) => w.id === 'stuck-mislabeled')!;
    expect(w.failed).toBe(true); // it does fail…
    expect(w.failedOnIntendedCategory).toBe(false); // …but not on "duty"
  }, 120_000);
});
