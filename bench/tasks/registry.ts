import type { BenchTask } from './types';
import unoLedBlink from './uno-led-blink/task';

/** All registered benchmark tasks, keyed by id. */
export const tasks: Record<string, BenchTask> = {
  [unoLedBlink.id]: unoLedBlink,
};

export function getTask(id: string): BenchTask | undefined {
  return tasks[id];
}

export function taskIds(): string[] {
  return Object.keys(tasks);
}
