interface ValueSample {
  tMs: number;
  value: number;
}

const WINDOW_MS = 5_000;

/** Build an efficient step path that holds the last value through the window end. */
export function sampleHoldTracePath(
  samples: ValueSample[],
  endMs: number,
  minValue: number,
  maxValue: number,
): string {
  const startMs = Math.max(0, endMs - WINDOW_MS);
  const beforeWindow = [...samples].reverse().find((sample) => sample.tMs <= startMs);
  const visible = samples.filter((sample) => sample.tMs > startMs && sample.tMs <= endMs);
  const held = beforeWindow ? [{ ...beforeWindow, tMs: startMs }, ...visible] : visible;
  if (held.length === 0) return '';

  const x = (time: number) => ((time - startMs) / WINDOW_MS) * 1000;
  const y = (value: number) => {
    const normalized = Math.max(0, Math.min(1, (value - minValue) / (maxValue - minValue)));
    return 70 - normalized * 60;
  };
  const parts = [`M ${x(held[0].tMs).toFixed(2)} ${y(held[0].value).toFixed(2)}`];
  let previous = held[0];
  for (let index = 1; index < held.length; index += 1) {
    const sample = held[index];
    const sampleX = x(sample.tMs).toFixed(2);
    parts.push(`L ${sampleX} ${y(previous.value).toFixed(2)}`);
    parts.push(`L ${sampleX} ${y(sample.value).toFixed(2)}`);
    previous = sample;
  }
  parts.push(`L 1000 ${y(previous.value).toFixed(2)}`);
  return parts.join(' ');
}
