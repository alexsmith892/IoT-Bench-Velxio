import { inspectionScenarios as rawScenarios } from 'virtual:inspection-scenarios';
import { boardPinToNumber } from '../utils/boardPinMapping';
import { validateVlxPayload, type VlxPayload } from '../utils/vlxFile';

export type PinEdgeDerivation = 'level' | 'digitalTiming' | 'waveform';
export type ValueDerivation = 'value' | 'trace';

export type TaskMonitorProbe =
  | {
      channel: 'pinEdges';
      pin: number;
      label: string;
      derive: PinEdgeDerivation[];
    }
  | {
      channel: 'serial';
      label: string;
      derive: ['log'];
    }
  | {
      channel: 'pwm';
      pin: number;
      label: string;
      derive: ValueDerivation[];
    }
  | {
      channel: 'adc';
      /** ADC channel number (A0 = 0), matching Trace.adcInputs. */
      pin: number;
      label: string;
      derive: ValueDerivation[];
    };

export interface TaskMonitorDefinition {
  boardId: string;
  probes: TaskMonitorProbe[];
}

export interface InspectionScenario {
  id: string;
  title: string;
  project: VlxPayload;
  taskMonitor: TaskMonitorDefinition;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPin(record: Record<string, unknown>): number {
  const value = record.pin;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error('Invalid task monitor probe pin.');
  }
  return value;
}

function readLabel(record: Record<string, unknown>): string {
  if (typeof record.label !== 'string' || !record.label.trim()) {
    throw new Error('Invalid task monitor probe label.');
  }
  return record.label;
}

function readDerivations<T extends string>(
  record: Record<string, unknown>,
  allowed: readonly T[],
): T[] {
  if (!Array.isArray(record.derive) || record.derive.length === 0) {
    throw new Error('Task monitor probe requires at least one derivation.');
  }
  const values = record.derive;
  if (
    !values.every((entry): entry is T => typeof entry === 'string' && allowed.includes(entry as T))
  ) {
    throw new Error(`Unsupported task monitor derivation for ${String(record.channel)}.`);
  }
  return [...new Set(values)];
}

function validateProbe(value: unknown): TaskMonitorProbe {
  if (!isRecord(value)) throw new Error('Invalid task monitor probe.');
  const label = readLabel(value);
  if (value.channel === 'pinEdges') {
    return {
      channel: 'pinEdges',
      pin: readPin(value),
      label,
      derive: readDerivations(value, ['level', 'digitalTiming', 'waveform']),
    };
  }
  if (value.channel === 'serial') {
    const derive = readDerivations(value, ['log']);
    return { channel: 'serial', label, derive: [derive[0]] };
  }
  if (value.channel === 'pwm' || value.channel === 'adc') {
    return {
      channel: value.channel,
      pin: readPin(value),
      label,
      derive: readDerivations(value, ['value', 'trace']),
    };
  }
  throw new Error(`Unsupported task monitor channel: ${String(value.channel)}`);
}

export function taskMonitorProbeKey(probe: TaskMonitorProbe): string {
  return probe.channel === 'serial' ? 'serial' : `${probe.channel}:${probe.pin}`;
}

/**
 * Default probes are circuit-derived, not task-derived: every connected MCU
 * GPIO candidate plus Serial. This intentionally includes connected inputs;
 * it guarantees all connected outputs are visible without parsing firmware.
 */
export function deriveDefaultTaskMonitor(
  project: VlxPayload,
  boardId?: string,
): TaskMonitorDefinition {
  const selectedBoardId = boardId ?? project.activeBoardId ?? project.boards[0]?.id;
  const board = project.boards.find((candidate) => candidate.id === selectedBoardId);
  if (!board) throw new Error(`Task monitor board was not found: ${selectedBoardId ?? ''}`);

  const pins = new Map<number, string>();
  for (const wire of project.wires) {
    for (const endpoint of [wire.start, wire.end]) {
      if (endpoint.componentId !== board.id) continue;
      const pin = boardPinToNumber(board.boardKind, endpoint.pinName);
      if (pin != null && pin >= 0 && !pins.has(pin)) pins.set(pin, endpoint.pinName);
    }
  }

  const probes: TaskMonitorProbe[] = [...pins.entries()]
    .sort(([left], [right]) => left - right)
    .map(([pin, pinName]) => ({
      channel: 'pinEdges',
      pin,
      label: `GPIO ${pinName}`,
      derive: ['level', 'digitalTiming', 'waveform'],
    }));
  probes.push({ channel: 'serial', label: 'Serial TX', derive: ['log'] });
  return { boardId: board.id, probes };
}

function validateTaskMonitor(value: unknown, project: VlxPayload): TaskMonitorDefinition {
  if (value === undefined) return deriveDefaultTaskMonitor(project);
  if (!isRecord(value)) throw new Error('Invalid benchmark task monitor metadata.');

  const boardId = typeof value.boardId === 'string' ? value.boardId : project.activeBoardId;
  if (!boardId || !project.boards.some((board) => board.id === boardId)) {
    throw new Error(`Task monitor board was not found: ${boardId ?? ''}`);
  }
  if (!Array.isArray(value.probes) || value.probes.length === 0) {
    throw new Error('Explicit task monitor metadata requires probes.');
  }
  const probes = value.probes.map(validateProbe);
  const keys = probes.map(taskMonitorProbeKey);
  if (new Set(keys).size !== keys.length) {
    throw new Error('Duplicate task monitor probe channel/pin.');
  }
  return { boardId, probes };
}

export function validateInspectionScenarios(values: unknown[]): InspectionScenario[] {
  const seenIds = new Set<string>();

  return values.map((value) => {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string') {
      throw new Error('Invalid benchmark inspection scenario metadata.');
    }
    if (!value.id || seenIds.has(value.id)) {
      throw new Error(`Duplicate or empty benchmark inspection scenario id: ${value.id}`);
    }
    seenIds.add(value.id);
    const project = validateVlxPayload(value.project);
    return {
      id: value.id,
      title: value.title,
      project,
      taskMonitor: validateTaskMonitor(value.taskMonitor, project),
    };
  });
}

export const inspectionScenarios = validateInspectionScenarios(rawScenarios);

export const useRuntimeBenchApi =
  import.meta.env.VITE_BENCH_MODE === 'true' && !import.meta.env.DEV;

export function findInspectionScenario(
  scenarios: InspectionScenario[],
  id: string | undefined,
): InspectionScenario | null {
  if (!id) return null;
  return scenarios.find((scenario) => scenario.id === id) ?? null;
}

export function getInspectionScenario(id: string | undefined): InspectionScenario | null {
  return findInspectionScenario(inspectionScenarios, id);
}

export async function loadInspectionScenario(
  id: string | undefined,
): Promise<InspectionScenario | null> {
  if (!id) return null;
  if (useRuntimeBenchApi) {
    const { fetchInspectionScenario } = await import('../services/benchScenariosService');
    return fetchInspectionScenario(id);
  }
  return getInspectionScenario(id);
}
