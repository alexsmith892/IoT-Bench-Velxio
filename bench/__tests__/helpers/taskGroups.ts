import { tasks, taskIds } from '../../tasks/registry';
import type { Difficulty, OneShotScenario } from '../../tasks/types';

const DIFFICULTIES: Difficulty[] = ['D1', 'D2', 'D3', 'D4'];

/** All registered tasks grouped by scored difficulty tier. */
export function tasksByDifficulty(): Record<Difficulty, OneShotScenario[]> {
  const grouped: Record<Difficulty, OneShotScenario[]> = {
    D1: [],
    D2: [],
    D3: [],
    D4: [],
  };
  for (const id of taskIds()) {
    const task = tasks[id];
    grouped[task.difficulty].push(task);
  }
  for (const tier of DIFFICULTIES) {
    grouped[tier].sort((a, b) => a.id.localeCompare(b.id));
  }
  return grouped;
}

export function taskIdsByDifficulty(tier: Difficulty): string[] {
  return tasksByDifficulty()[tier].map((t) => t.id);
}
