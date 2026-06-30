import type { OneShotScenario } from './types';
import unoLedBlink from './uno-led-blink/task';

/** All registered one-shot scenarios, keyed by id. */
export const tasks: Record<string, OneShotScenario> = {
  [unoLedBlink.id]: unoLedBlink,
};

export function getTask(id: string): OneShotScenario | undefined {
  return tasks[id];
}

export function taskIds(): string[] {
  return Object.keys(tasks);
}
