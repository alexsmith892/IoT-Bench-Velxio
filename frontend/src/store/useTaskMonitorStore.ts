import { create } from 'zustand';
import type { TaskMonitorDefinition, TaskMonitorProbe } from '../lib/inspectionScenarios';
import { taskMonitorProbeKey } from '../lib/inspectionScenarios';
import { subscribeSimulationTelemetry } from '../simulation/simulationTelemetry';

export const TASK_MONITOR_MAX_EDGES = 10_000;
export const TASK_MONITOR_MAX_SAMPLES = 10_000;
export const TASK_MONITOR_MAX_SERIAL_BYTES = 20_000;

export interface TaskMonitorEdge {
  tMs: number;
  value: 0 | 1;
}

export interface TaskMonitorSerialByte {
  tMs: number;
  byte: number;
  char: string;
}

export interface TaskMonitorValueSample {
  tMs: number;
  value: number;
}

export type TaskMonitorCapture =
  | { channel: 'pinEdges'; initialState: 0 | 1; edges: TaskMonitorEdge[] }
  | { channel: 'serial'; bytes: TaskMonitorSerialByte[] }
  | { channel: 'pwm'; samples: TaskMonitorValueSample[] }
  | { channel: 'adc'; samples: TaskMonitorValueSample[] };

type MonitorStatus = 'idle' | 'running' | 'stopped';

interface TaskMonitorState {
  definition: TaskMonitorDefinition | null;
  status: MonitorStatus;
  captures: Record<string, TaskMonitorCapture>;
  stoppedAtMs: number | null;
  configure: (definition: TaskMonitorDefinition | null) => void;
}

function emptyCapture(probe: TaskMonitorProbe): TaskMonitorCapture {
  if (probe.channel === 'pinEdges') return { channel: 'pinEdges', initialState: 0, edges: [] };
  if (probe.channel === 'serial') return { channel: 'serial', bytes: [] };
  return { channel: probe.channel, samples: [] };
}

function emptyCaptures(
  definition: TaskMonitorDefinition | null,
): Record<string, TaskMonitorCapture> {
  if (!definition) return {};
  return Object.fromEntries(
    definition.probes.map((probe) => [taskMonitorProbeKey(probe), emptyCapture(probe)]),
  );
}

function bounded<T>(values: T[], limit: number): T[] {
  return values.length > limit ? values.slice(values.length - limit) : values;
}

export const useTaskMonitorStore = create<TaskMonitorState>((set) => ({
  definition: null,
  status: 'idle',
  captures: {},
  stoppedAtMs: null,
  configure: (definition) =>
    set({ definition, status: 'idle', captures: emptyCaptures(definition), stoppedAtMs: null }),
}));

subscribeSimulationTelemetry((event) => {
  const state = useTaskMonitorStore.getState();
  const definition = state.definition;
  if (!definition || event.boardId !== definition.boardId) return;

  if (event.type === 'run-start') {
    useTaskMonitorStore.setState({
      status: 'running',
      captures: emptyCaptures(definition),
      stoppedAtMs: null,
    });
    return;
  }

  if (event.type === 'reset') {
    useTaskMonitorStore.setState({
      status: 'idle',
      captures: emptyCaptures(definition),
      stoppedAtMs: null,
    });
    return;
  }

  if (event.type === 'run-stop') {
    useTaskMonitorStore.setState({ status: 'stopped', stoppedAtMs: event.timeMs });
    return;
  }

  if (state.status !== 'running') return;

  useTaskMonitorStore.setState((current) => {
    const captures = { ...current.captures };

    if (event.type === 'digital-edge') {
      const key = `pinEdges:${event.pin}`;
      const capture = captures[key];
      if (!capture || capture.channel !== 'pinEdges') return current;
      const value = event.state ? 1 : 0;
      const last = capture.edges[capture.edges.length - 1];
      if (last && (event.timeMs < last.tMs || last.value === value)) return current;
      captures[key] = {
        ...capture,
        edges: bounded([...capture.edges, { tMs: event.timeMs, value }], TASK_MONITOR_MAX_EDGES),
      };
    } else if (event.type === 'serial-byte') {
      const capture = captures.serial;
      if (!capture || capture.channel !== 'serial') return current;
      captures.serial = {
        channel: 'serial',
        bytes: bounded(
          [...capture.bytes, { tMs: event.timeMs, byte: event.byte, char: event.char }],
          TASK_MONITOR_MAX_SERIAL_BYTES,
        ),
      };
    } else if (event.type === 'pwm-sample') {
      const key = `pwm:${event.pin}`;
      const capture = captures[key];
      if (!capture || capture.channel !== 'pwm') return current;
      captures[key] = {
        channel: 'pwm',
        samples: bounded(
          [...capture.samples, { tMs: event.timeMs, value: event.duty }],
          TASK_MONITOR_MAX_SAMPLES,
        ),
      };
    } else if (event.type === 'adc-input') {
      const key = `adc:${event.channel}`;
      const capture = captures[key];
      if (!capture || capture.channel !== 'adc') return current;
      captures[key] = {
        channel: 'adc',
        samples: bounded(
          [...capture.samples, { tMs: event.timeMs, value: event.volts }],
          TASK_MONITOR_MAX_SAMPLES,
        ),
      };
    } else {
      return current;
    }

    return { captures };
  });
});
