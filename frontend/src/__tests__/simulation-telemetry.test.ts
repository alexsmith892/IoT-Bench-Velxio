import { describe, expect, it, vi } from 'vitest';
import {
  configureSimulationTimeReader,
  publishSimulationTelemetry,
  readSimulationTimeMs,
  subscribeSimulationTelemetry,
  type SimulationTelemetryEvent,
} from '../simulation/simulationTelemetry';

describe('simulation telemetry hub', () => {
  it('fans events out in order and unsubscribes cleanly', () => {
    const received: SimulationTelemetryEvent[] = [];
    const unsubscribe = subscribeSimulationTelemetry((event) => received.push(event));
    publishSimulationTelemetry({ type: 'run-start', boardId: 'uno' });
    publishSimulationTelemetry({
      type: 'digital-edge',
      boardId: 'uno',
      pin: 13,
      state: true,
      timeMs: 2,
    });
    unsubscribe();
    publishSimulationTelemetry({ type: 'run-stop', boardId: 'uno', timeMs: 3 });
    expect(received.map((event) => event.type)).toEqual(['run-start', 'digital-edge']);
  });

  it('normalizes invalid clock readings', () => {
    const reader = vi.fn((boardId: string) => (boardId === 'uno' ? 123.5 : Number.NaN));
    configureSimulationTimeReader(reader);
    expect(readSimulationTimeMs('uno')).toBe(123.5);
    expect(readSimulationTimeMs('missing')).toBe(0);
  });
});
