import { validateVlxPayload, type VlxPayload } from '../utils/vlxFile';
import { inspectionScenarios as rawScenarios } from 'virtual:inspection-scenarios';

export interface InspectionScenario {
  id: string;
  title: string;
  project: VlxPayload;
  taskMonitor?: TaskMonitorDefinition;
}

export type TaskMonitorDefinition = {
  kind: 'led-blink';
  source: {
    boardId: string;
    componentId: string;
    pin: number;
    label: string;
  };
  target: {
    frequencyHz: number;
    dutyCycle: number;
    tolerancePct: number;
    minPeriods: number;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readFiniteNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid task monitor number: ${key}`);
  }
  return value;
}

function validateTaskMonitor(value: unknown, project: VlxPayload): TaskMonitorDefinition {
  if (!isRecord(value) || value.kind !== 'led-blink') {
    throw new Error('Invalid or unsupported benchmark task monitor.');
  }
  if (!isRecord(value.source) || !isRecord(value.target)) {
    throw new Error('Invalid LED task monitor metadata.');
  }

  const { source, target } = value;
  if (
    typeof source.boardId !== 'string' ||
    typeof source.componentId !== 'string' ||
    typeof source.label !== 'string'
  ) {
    throw new Error('Invalid LED task monitor source.');
  }

  const pin = readFiniteNumber(source, 'pin');
  const frequencyHz = readFiniteNumber(target, 'frequencyHz');
  const dutyCycle = readFiniteNumber(target, 'dutyCycle');
  const tolerancePct = readFiniteNumber(target, 'tolerancePct');
  const minPeriods = readFiniteNumber(target, 'minPeriods');

  if (!Number.isInteger(pin) || pin < 0) throw new Error('Invalid LED task monitor pin.');
  if (frequencyHz <= 0) throw new Error('Invalid LED task monitor frequency.');
  if (dutyCycle < 0 || dutyCycle > 1) throw new Error('Invalid LED task monitor duty cycle.');
  if (tolerancePct < 0) throw new Error('Invalid LED task monitor tolerance.');
  if (!Number.isInteger(minPeriods) || minPeriods < 1) {
    throw new Error('Invalid LED task monitor minimum periods.');
  }
  if (!project.boards.some((board) => board.id === source.boardId)) {
    throw new Error(`Task monitor board was not found: ${source.boardId}`);
  }
  if (!project.components.some((component) => component.id === source.componentId)) {
    throw new Error(`Task monitor component was not found: ${source.componentId}`);
  }

  return {
    kind: 'led-blink',
    source: { boardId: source.boardId, componentId: source.componentId, pin, label: source.label },
    target: { frequencyHz, dutyCycle, tolerancePct, minPeriods },
  };
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
      ...(value.taskMonitor
        ? { taskMonitor: validateTaskMonitor(value.taskMonitor, project) }
        : {}),
    };
  });
}

export const inspectionScenarios = validateInspectionScenarios(rawScenarios);

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
