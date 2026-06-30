import { describe, it, expect } from 'vitest';
import { buildArtifact } from '../runner/artifact';
import type { RunResult } from '../runner/runTask';
import type { BenchTask } from '../tasks/types';

const task = { id: 'demo', board: 'arduino:avr:uno', runMs: 1000 } as BenchTask;
const result: RunResult = {
  taskId: 'demo',
  verdict: 'PASS',
  pass: true,
  results: [{ name: 'ledBlinks(led)', pass: true, reason: 'ok' }],
  trace: { pinEdges: [{ tMs: 0, pin: 13, value: 1 }], serial: [], adcInputs: [], pwmSamples: [], serialInputs: [], durationMs: 1000, finalState: {} },
  compileStderr: '',
};

describe('buildArtifact', () => {
  it('captures task metadata, verdict, results and the full trace', () => {
    const a = buildArtifact(task, result, 'reference');
    expect(a).toMatchObject({
      taskId: 'demo',
      label: 'reference',
      board: 'arduino:avr:uno',
      runMs: 1000,
      verdict: 'PASS',
      pass: true,
    });
    expect(a.results).toHaveLength(1);
    expect(a.trace?.pinEdges).toEqual([{ tMs: 0, pin: 13, value: 1 }]);
    expect(() => new Date(a.savedAt).toISOString()).not.toThrow();
  });
});
