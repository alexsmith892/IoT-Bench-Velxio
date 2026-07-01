import axios from 'axios';
import { getApiBase } from '../lib/apiBase';
import type { InspectionScenario } from '../lib/inspectionScenarios';
import { validateInspectionScenarios } from '../lib/inspectionScenarios';

export interface InspectionScenarioSummary {
  id: string;
  title: string;
}

interface ScenarioListResponse {
  scenarios: InspectionScenarioSummary[];
}

export class BenchScenarioNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BenchScenarioNotFoundError';
  }
}

function benchBaseUrl(): string {
  return `${getApiBase()}/bench`;
}

export async function listInspectionScenarios(): Promise<InspectionScenarioSummary[]> {
  const response = await axios.get<ScenarioListResponse>(`${benchBaseUrl()}/scenarios`);
  return response.data.scenarios;
}

export async function fetchInspectionScenario(id: string): Promise<InspectionScenario> {
  try {
    const response = await axios.get<unknown>(`${benchBaseUrl()}/scenarios/${encodeURIComponent(id)}`);
    const [scenario] = validateInspectionScenarios([response.data]);
    if (!scenario) {
      throw new BenchScenarioNotFoundError(`Inspection scenario "${id}" was not found.`);
    }
    return scenario;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      const detail =
        typeof error.response.data?.detail === 'string'
          ? error.response.data.detail
          : `Inspection scenario "${id}" was not found.`;
      throw new BenchScenarioNotFoundError(detail);
    }
    throw error;
  }
}
