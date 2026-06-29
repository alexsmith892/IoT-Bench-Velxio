export type SimulationTelemetryEvent =
  | { type: 'run-start'; boardId: string }
  | { type: 'run-stop'; boardId: string; timeMs: number }
  | { type: 'reset'; boardId: string }
  | {
      type: 'digital-edge';
      boardId: string;
      pin: number;
      state: boolean;
      timeMs: number;
    };

export type SimulationTelemetryListener = (event: SimulationTelemetryEvent) => void;

const listeners = new Set<SimulationTelemetryListener>();
let timeReader: (boardId: string) => number = () => 0;

/** Passive fan-out for browser simulation observations. */
export function publishSimulationTelemetry(event: SimulationTelemetryEvent): void {
  for (const listener of [...listeners]) listener(event);
}

export function subscribeSimulationTelemetry(listener: SimulationTelemetryListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function configureSimulationTimeReader(reader: (boardId: string) => number): void {
  timeReader = reader;
}

export function readSimulationTimeMs(boardId: string): number {
  const value = timeReader(boardId);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
