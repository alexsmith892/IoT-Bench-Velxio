import { afterEach, describe, expect, it } from 'vitest';
import type { TaskMonitorDefinition } from '../lib/inspectionScenarios';
import { publishSimulationTelemetry } from '../simulation/simulationTelemetry';
import { TASK_MONITOR_MAX_EDGES, useTaskMonitorStore } from '../store/useTaskMonitorStore';

const definition: TaskMonitorDefinition = {
  kind: 'led-blink',
  source: { boardId: 'arduino-uno', componentId: 'bench_led', pin: 13, label: 'LED' },
  target: { frequencyHz: 1, dutyCycle: 0.5, tolerancePct: 5, minPeriods: 2 },
};

afterEach(() => useTaskMonitorStore.getState().configure(null));

describe('task monitor capture', () => {
  it('filters its source and freezes the capture on stop', () => {
    useTaskMonitorStore.getState().configure(definition);
    publishSimulationTelemetry({ type: 'run-start', boardId: 'arduino-uno' });
    publishSimulationTelemetry({
      type: 'digital-edge',
      boardId: 'other',
      pin: 13,
      state: true,
      timeMs: 1,
    });
    publishSimulationTelemetry({
      type: 'digital-edge',
      boardId: 'arduino-uno',
      pin: 12,
      state: true,
      timeMs: 2,
    });
    publishSimulationTelemetry({
      type: 'digital-edge',
      boardId: 'arduino-uno',
      pin: 13,
      state: true,
      timeMs: 3,
    });
    publishSimulationTelemetry({ type: 'run-stop', boardId: 'arduino-uno', timeMs: 4 });
    publishSimulationTelemetry({
      type: 'digital-edge',
      boardId: 'arduino-uno',
      pin: 13,
      state: false,
      timeMs: 5,
    });

    expect(useTaskMonitorStore.getState()).toMatchObject({
      status: 'stopped',
      stoppedAtMs: 4,
      edges: [{ tMs: 3, value: 1 }],
    });
  });

  it('bounds memory and clears on reset', () => {
    useTaskMonitorStore.getState().configure(definition);
    publishSimulationTelemetry({ type: 'run-start', boardId: 'arduino-uno' });
    useTaskMonitorStore.setState({
      edges: Array.from({ length: TASK_MONITOR_MAX_EDGES }, (_, index) => ({
        tMs: index,
        value: (index % 2) as 0 | 1,
      })),
    });
    for (let index = TASK_MONITOR_MAX_EDGES; index < TASK_MONITOR_MAX_EDGES + 2; index += 1) {
      publishSimulationTelemetry({
        type: 'digital-edge',
        boardId: 'arduino-uno',
        pin: 13,
        state: index % 2 === 0,
        timeMs: index,
      });
    }
    expect(useTaskMonitorStore.getState().edges).toHaveLength(TASK_MONITOR_MAX_EDGES);
    publishSimulationTelemetry({ type: 'reset', boardId: 'arduino-uno' });
    expect(useTaskMonitorStore.getState()).toMatchObject({ status: 'idle', edges: [] });
  });
});
