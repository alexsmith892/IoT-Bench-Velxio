/**
 * Trace dumper — a compact, human-readable summary of a Trace for eyeballing
 * during authoring (benchmark-notes one-shot-implementation-plan Pass 1; doc 03
 * Codex note: "build a trace dumper/viewer before a big assertion library").
 *
 * Pure (no I/O): the CLI prints it and a unit test asserts its shape. It reads
 * ONLY the Trace, like a contract — so it stays board-agnostic and grows as the
 * Trace gains channels (pwm/adc/bus/display) in later passes.
 */
import type { Trace } from './trace';
import { edgesForPin, serialText } from './trace';

const MAX_EDGES_SHOWN = 16;
const MAX_SERIAL_CHARS = 200;

function escapeSerial(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/** e.g. "trace 3000ms (halt: budget)\n  pin 13: ↑0ms ↓500ms … [6 edges]\n  serial: …" */
export function traceDump(trace: Trace): string {
  const lines: string[] = [];

  const haltVal = trace.finalState?.halt;
  const halt = typeof haltVal === 'string' ? ` (halt: ${haltVal})` : '';
  lines.push(`trace ${Math.round(trace.durationMs)}ms${halt}`);

  // Pin edges, grouped per pin, ascending pin number.
  const pins = [...new Set(trace.pinEdges.map((e) => e.pin))].sort((a, b) => a - b);
  if (pins.length === 0) {
    lines.push('  pins: (no edges)');
  } else {
    for (const pin of pins) {
      const edges = edgesForPin(trace, pin);
      const shown = edges
        .slice(0, MAX_EDGES_SHOWN)
        .map((e) => `${e.value ? '↑' : '↓'}${Math.round(e.tMs)}ms`)
        .join(' ');
      const more = edges.length > MAX_EDGES_SHOWN ? ` …(+${edges.length - MAX_EDGES_SHOWN})` : '';
      const plural = edges.length === 1 ? '' : 's';
      lines.push(`  pin ${String(pin).padStart(2)}: ${shown}${more} [${edges.length} edge${plural}]`);
    }
  }

  // Serial TX text.
  const text = serialText(trace);
  if (text.length === 0) {
    lines.push('  serial: (none)');
  } else {
    const clipped = text.length > MAX_SERIAL_CHARS ? `${text.slice(0, MAX_SERIAL_CHARS)}…` : text;
    const plural = text.length === 1 ? '' : 's';
    lines.push(`  serial: "${escapeSerial(clipped)}" [${text.length} byte${plural}]`);
  }

  // Echoed ADC stimulus, grouped per channel (first → last + count).
  if (trace.adcInputs.length > 0) {
    const channels = [...new Set(trace.adcInputs.map((a) => a.channel))].sort((a, b) => a - b);
    for (const ch of channels) {
      const pts = trace.adcInputs.filter((a) => a.channel === ch);
      const first = pts[0].volts.toFixed(2);
      const last = pts[pts.length - 1].volts.toFixed(2);
      const span = pts.length === 1 ? `${first}V` : `${first}→${last}V`;
      lines.push(`  adc ch${ch}: ${span} [${pts.length} pt${pts.length === 1 ? '' : 's'}]`);
    }
  }

  // Any remaining finalState keys (halt already shown above).
  const finalKeys = Object.keys(trace.finalState ?? {}).filter((k) => k !== 'halt');
  if (finalKeys.length > 0) {
    const obj: Record<string, unknown> = {};
    for (const k of finalKeys) obj[k] = trace.finalState[k];
    lines.push(`  final: ${JSON.stringify(obj)}`);
  }

  return lines.join('\n');
}
