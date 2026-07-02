import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { taskIdsByDifficulty } from '../helpers/taskGroups';

const TASKS_DIR = new URL('../tasks/', import.meta.url);

function gateTestPath(taskId: string): string {
  return fileURLToPath(new URL(`${taskId}/gate.test.ts`, TASKS_DIR));
}

function assertTierStructure(tier: 'D1' | 'D2' | 'D3' | 'D4', expectedIds: string[]): void {
  const ids = taskIdsByDifficulty(tier);
  expect(ids).toEqual([...expectedIds].sort());
  for (const id of ids) {
    expect(existsSync(gateTestPath(id)), `missing __tests__/tasks/${id}/gate.test.ts`).toBe(true);
  }
}

describe('D3 family structure', () => {
  it('lists the D3 tasks with per-task gate tests', () => {
    assertTierStructure('D3', [
      'appliance-cycle-fsm',
      'binary-framed-protocol',
      'cooperative-scheduler',
      'four-mode-indicator',
      'persistent-event-counter',
      'quadrature-position',
      'reaction-timer-fsm',
      'servo-slew-position',
      'software-pwm-fade',
    ]);
  });
});

describe('D4 family structure', () => {
  it('lists the D4 tasks with per-task gate tests', () => {
    assertTierStructure('D4', ['water-tank-controller', 'zone-climate-controller']);
  });
});
