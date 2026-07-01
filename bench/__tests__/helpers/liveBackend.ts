import type { GateOptions } from '../../gate/gate';

export const API_BASE = process.env.BENCH_API_BASE ?? 'http://127.0.0.1:8001';

export async function backendUp(): Promise<boolean> {
  try {
    return (await fetch(`${API_BASE}/docs`)).ok;
  } catch {
    return false;
  }
}

export const defaultGateOpts = { apiBase: API_BASE, noArtifact: true as const } satisfies GateOptions;
