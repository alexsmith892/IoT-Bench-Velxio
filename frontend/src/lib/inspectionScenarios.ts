import { validateVlxPayload, type VlxPayload } from '../utils/vlxFile';
import { inspectionScenarios as rawScenarios } from 'virtual:inspection-scenarios';

export interface InspectionScenario {
  id: string;
  title: string;
  project: VlxPayload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    return {
      id: value.id,
      title: value.title,
      project: validateVlxPayload(value.project),
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
