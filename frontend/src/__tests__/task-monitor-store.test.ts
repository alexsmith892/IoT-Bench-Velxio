import { afterEach, describe, expect, it } from 'vitest';
import type { TaskMonitorDefinition } from '../lib/inspectionScenarios';
import { publishSimulationTelemetry } from '../simulation/simulationTelemetry';
import { TASK_MONITOR_MAX_EDGES, useTaskMonitorStore } from '../store/useTaskMonitorStore';

const definition: TaskMonitorDefinition = {
  boardId: 'arduino-uno',
  probes: [
    { channel: 'pinEdges', pin: 13, label: 'LED', derive: ['level', 'digitalTiming'] },
    { channel: 'serial', label: 'Serial', derive: ['log'] },
    { channel: 'pwm', pin: 3, label: 'PWM', derive: ['value', 'trace'] },
    { channel: 'adc', pin: 1, label: 'ADC', derive: ['value', 'trace'] },
  ],
};

afterEach(() => useTaskMonitorStore.getState().configure(null));

function publishCompleteCapture(): void {
  publishSimulationTelemetry({ type: 'run-start', boardId: 'arduino-uno' });
  publishSimulationTelemetry({
    type: 'digital-edge',
    boardId: 'arduino-uno',
    pin: 13,
    state: true,
    timeMs: 1,
  });
  publishSimulationTelemetry({
    type: 'serial-byte',
    boardId: 'arduino-uno',
    byte: 65,
    char: 'A',
    timeMs: 2,
  });
  publishSimulationTelemetry({
    type: 'pwm-sample',
    boardId: 'arduino-uno',
    pin: 3,
    duty: 0.5,
    timeMs: 3,
  });
  publishSimulationTelemetry({
    type: 'adc-input',
    boardId: 'arduino-uno',
    channel: 1,
    volts: 2.5,
    timeMs: 4,
  });
}

describe('task monitor capture', () => {
  it('captures every configured channel, filters sources, and freezes on stop', () => {
    useTaskMonitorStore.getState().configure(definition);
    publishCompleteCapture();
    publishSimulationTelemetry({
      type: 'serial-byte',
      boardId: 'other',
      byte: 66,
      char: 'B',
      timeMs: 4,
    });
    publishSimulationTelemetry({ type: 'run-stop', boardId: 'arduino-uno', timeMs: 5 });
    publishSimulationTelemetry({
      type: 'digital-edge',
      boardId: 'arduino-uno',
      pin: 13,
      state: false,
      timeMs: 6,
    });

    expect(useTaskMonitorStore.getState()).toMatchObject({ status: 'stopped', stoppedAtMs: 5 });
    expect(useTaskMonitorStore.getState().captures).toMatchObject({
      'pinEdges:13': { edges: [{ tMs: 1, value: 1 }] },
      serial: { bytes: [{ tMs: 2, byte: 65, char: 'A' }] },
      'pwm:3': { samples: [{ tMs: 3, value: 0.5 }] },
      'adc:1': { samples: [{ tMs: 4, value: 2.5 }] },
    });
  });

  it('bounds digital memory and clears every probe on reset', () => {
    useTaskMonitorStore.getState().configure(definition);
    publishSimulationTelemetry({ type: 'run-start', boardId: 'arduino-uno' });
    useTaskMonitorStore.setState((state) => ({
      captures: {
        ...state.captures,
        'pinEdges:13': {
          channel: 'pinEdges',
          initialState: 0,
          edges: Array.from({ length: TASK_MONITOR_MAX_EDGES }, (_, index) => ({
            tMs: index,
            value: (index % 2) as 0 | 1,
          })),
        },
      },
    }));
    publishSimulationTelemetry({
      type: 'digital-edge',
      boardId: 'arduino-uno',
      pin: 13,
      state: false,
      timeMs: TASK_MONITOR_MAX_EDGES,
    });
    const digital = useTaskMonitorStore.getState().captures['pinEdges:13'];
    expect(digital?.channel === 'pinEdges' ? digital.edges : []).toHaveLength(
      TASK_MONITOR_MAX_EDGES,
    );

    publishSimulationTelemetry({ type: 'reset', boardId: 'arduino-uno' });
    expect(useTaskMonitorStore.getState()).toMatchObject({ status: 'idle', stoppedAtMs: null });
    expect(useTaskMonitorStore.getState().captures).toMatchObject({
      'pinEdges:13': { edges: [] },
      serial: { bytes: [] },
      'pwm:3': { samples: [] },
      'adc:1': { samples: [] },
    });
  });

  it('produces byte-identical captures over three fresh runs', () => {
    const runs = Array.from({ length: 3 }, () => {
      useTaskMonitorStore.getState().configure(definition);
      publishCompleteCapture();
      return JSON.stringify(useTaskMonitorStore.getState().captures);
    });
    expect(new Set(runs)).toHaveLength(1);
  });
});
