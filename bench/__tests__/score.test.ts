import { describe, it, expect } from 'vitest';
import {
  variantScore,
  taskScore,
  headline,
  variantStrict,
  taskStrict,
} from '../runner/score';
import type { AssertionResult } from '../contracts/types';

const r = (pass: boolean, weight?: number): AssertionResult => ({
  name: 'a',
  pass,
  reason: '',
  weight,
});

describe('partial-credit scoring (§6b)', () => {
  it('scores 5 of 6 equal-weight assertions as 0.83, not 0', () => {
    const results = [r(true), r(true), r(true), r(true), r(true), r(false)];
    expect(variantScore(results)).toBeCloseTo(5 / 6, 5);
    expect(variantScore(results)).toBeCloseTo(0.8333, 3);
  });

  it('all pass → 1, all fail → 0, empty contract → 0', () => {
    expect(variantScore([r(true), r(true)])).toBe(1);
    expect(variantScore([r(false), r(false)])).toBe(0);
    expect(variantScore([])).toBe(0);
  });
});

describe('value/format weighting (§6c)', () => {
  it('correct value (0.7) but wrong format (0.3) → 0.7', () => {
    const results = [r(true, 0.7), r(false, 0.3)];
    expect(variantScore(results)).toBeCloseTo(0.7, 5);
  });

  it('right format (0.3) but wrong value (0.7) → 0.3 (cannot pass on format)', () => {
    const results = [r(false, 0.7), r(true, 0.3)];
    expect(variantScore(results)).toBeCloseTo(0.3, 5);
  });
});

describe('aggregation', () => {
  it('task_score = mean(variants), headline = mean(tasks)', () => {
    expect(taskScore([1, 0.5])).toBe(0.75);
    expect(headline([0.75, 0.25, 1])).toBeCloseTo(2 / 3, 5);
  });
});

describe('strict score (diagnostic)', () => {
  it('variantStrict requires every assertion to pass', () => {
    expect(variantStrict([r(true), r(true)])).toBe(true);
    expect(variantStrict([r(true), r(false)])).toBe(false);
    expect(variantStrict([])).toBe(false);
  });

  it('taskStrict is 1 only when all variants pass strictly', () => {
    expect(taskStrict([[r(true)], [r(true), r(true)]])).toBe(1);
    expect(taskStrict([[r(true)], [r(true), r(false)]])).toBe(0);
  });
});
