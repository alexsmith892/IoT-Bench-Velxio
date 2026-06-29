export interface DigitalEdge {
  tMs: number;
  value: 0 | 1;
}

export interface DigitalTiming {
  edgeCount: number;
  periods: number[];
  duties: number[];
  meanPeriodMs: number | null;
  freqHz: number | null;
  dutyMean: number | null;
  latestHighMs: number | null;
  latestLowMs: number | null;
}

const mean = (values: number[]): number | null =>
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

/**
 * Derive timing measurements from chronological digital transitions.
 * A complete period is measured rising-edge to rising-edge, matching the
 * benchmark's observable contract. Incomplete leading/trailing phases do not
 * contribute to frequency or duty-cycle measurements.
 */
export function analyzeDigitalTiming(
  edges: readonly DigitalEdge[],
): DigitalTiming {
  const rising = edges
    .filter((edge) => edge.value === 1)
    .map((edge) => edge.tMs);
  const falling = edges
    .filter((edge) => edge.value === 0)
    .map((edge) => edge.tMs);

  const periods: number[] = [];
  for (let index = 1; index < rising.length; index += 1) {
    periods.push(rising[index] - rising[index - 1]);
  }

  const duties: number[] = [];
  for (let index = 0; index < rising.length - 1; index += 1) {
    const riseT = rising[index];
    const nextRiseT = rising[index + 1];
    const fallT = falling.find((time) => time > riseT && time < nextRiseT);
    if (fallT !== undefined) duties.push((fallT - riseT) / (nextRiseT - riseT));
  }

  let latestHighMs: number | null = null;
  let latestLowMs: number | null = null;
  for (let index = 1; index < edges.length; index += 1) {
    const previous = edges[index - 1];
    const current = edges[index];
    const duration = current.tMs - previous.tMs;
    if (duration < 0) continue;
    if (previous.value === 1) latestHighMs = duration;
    else latestLowMs = duration;
  }

  const meanPeriodMs = mean(periods);
  return {
    edgeCount: edges.length,
    periods,
    duties,
    meanPeriodMs,
    freqHz: meanPeriodMs && meanPeriodMs > 0 ? 1000 / meanPeriodMs : null,
    dutyMean: mean(duties),
    latestHighMs,
    latestLowMs,
  };
}
