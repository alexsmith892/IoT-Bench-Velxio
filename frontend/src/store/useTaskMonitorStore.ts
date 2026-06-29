import { create } from 'zustand';
import type { TaskMonitorDefinition } from '../lib/inspectionScenarios';
import { getBoardPinManager } from './useSimulatorStore';
import { subscribeSimulationTelemetry } from '../simulation/simulationTelemetry';

export const TASK_MONITOR_MAX_EDGES = 10_000;

export interface TaskMonitorEdge {
  tMs: number;
  value: 0 | 1;
}

type MonitorStatus = 'idle' | 'running' | 'stopped';

interface TaskMonitorState {
  definition: TaskMonitorDefinition | null;
  status: MonitorStatus;
  initialState: 0 | 1;
  edges: TaskMonitorEdge[];
  stoppedAtMs: number | null;
  configure: (definition: TaskMonitorDefinition | null) => void;
}

export const useTaskMonitorStore = create<TaskMonitorState>((set) => ({
  definition: null,
  status: 'idle',
  initialState: 0,
  edges: [],
  stoppedAtMs: null,
  configure: (definition) =>
    set({ definition, status: 'idle', initialState: 0, edges: [], stoppedAtMs: null }),
}));

subscribeSimulationTelemetry((event) => {
  const state = useTaskMonitorStore.getState();
  const definition = state.definition;
  if (!definition || event.boardId !== definition.source.boardId) return;

  if (event.type === 'run-start') {
    const initialState = getBoardPinManager(event.boardId)?.getPinState(definition.source.pin)
      ? 1
      : 0;
    useTaskMonitorStore.setState({
      status: 'running',
      initialState,
      edges: [],
      stoppedAtMs: null,
    });
    return;
  }

  if (event.type === 'reset') {
    useTaskMonitorStore.setState({ status: 'idle', initialState: 0, edges: [], stoppedAtMs: null });
    return;
  }

  if (event.type === 'run-stop') {
    useTaskMonitorStore.setState({ status: 'stopped', stoppedAtMs: event.timeMs });
    return;
  }

  if (
    event.type === 'digital-edge' &&
    event.pin === definition.source.pin &&
    state.status === 'running'
  ) {
    useTaskMonitorStore.setState((current) => {
      const last = current.edges[current.edges.length - 1];
      if (last && (event.timeMs < last.tMs || last.value === Number(event.state))) return current;
      const next = [...current.edges, { tMs: event.timeMs, value: event.state ? 1 : 0 } as const];
      if (next.length > TASK_MONITOR_MAX_EDGES) {
        next.splice(0, next.length - TASK_MONITOR_MAX_EDGES);
      }
      return { edges: next };
    });
  }
});
