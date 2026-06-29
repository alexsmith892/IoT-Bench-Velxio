/**
 * LED-pin resolver — the board/pin-agnostic core of the harness.
 *
 * Given a circuit and an LED component id, walk the wire graph (union-find over
 * every wire's `componentId:pinName` endpoints) to find which MCU digital pin
 * is electrically connected to the LED's anode. The contract therefore names a
 * *component* and the pin is derived from the actual wiring — so the same
 * contract works on any board, on any pin, and inside multi-peripheral
 * circuits. Reuses the netting approach of
 * `frontend/src/simulation/spice/NetlistBuilder.ts`.
 */
import type { CircuitProject } from '../scenarios/types';
import { UnionFind } from './unionFind';

const GROUND_PIN_RE = /^(gnd|vss|vee)/i;
const VCC_PIN_RE = /^(vcc|vdd|3v3|5v|v\+|vbus|vin)/i;

/** LED anode pin name across wokwi/velxio elements. */
const LED_ANODE_PINS = ['A', 'anode'];

/**
 * Two-terminal series components that current passes straight through, so the
 * net-tracing must bridge their terminals (a wire connects to one pin; the
 * other pin is the same node electrically). Without this, a pin → resistor →
 * LED chain reads as three disjoint nets and the LED never resolves to a pin.
 */
const PASSTHROUGH_METADATA = new Set(['resistor']);

const pinKey = (componentId: string, pinName: string) => `${componentId}:${pinName}`;

/** A board pin name that denotes a numeric digital Arduino pin (e.g. "13"). */
function digitalPinNumber(pinName: string): number | null {
  return /^\d+$/.test(pinName) ? Number(pinName) : null;
}

export interface ResolveLedPinOptions {
  /** Override which pin name on the LED counts as the anode. */
  anodePinNames?: string[];
}

/**
 * Resolve the MCU digital pin driving the given LED, or throw a descriptive
 * error naming what was found (so authoring mistakes are obvious).
 */
export function resolveLedPin(
  circuit: CircuitProject,
  ledComponentId: string,
  options: ResolveLedPinOptions = {},
): number {
  const led = circuit.components.find((c) => c.id === ledComponentId);
  if (!led) {
    throw new Error(`resolveLedPin: no component "${ledComponentId}" in circuit.`);
  }

  const uf = new UnionFind();
  for (const w of circuit.wires) {
    uf.union(pinKey(w.start.componentId, w.start.pinName), pinKey(w.end.componentId, w.end.pinName));
  }

  // Bridge the terminals of wire-transparent series components (e.g. the
  // current-limiting resistor between the MCU pin and the LED anode), so the
  // net trace passes through them.
  for (const comp of circuit.components) {
    if (!PASSTHROUGH_METADATA.has(comp.metadataId)) continue;
    const pins = pinsOnComponent(circuit, comp.id);
    for (let i = 1; i < pins.length; i++) {
      uf.union(pinKey(comp.id, pins[0]), pinKey(comp.id, pins[i]));
    }
  }

  const anodeNames = options.anodePinNames ?? LED_ANODE_PINS;
  const anodeKey = anodeNames
    .map((p) => pinKey(ledComponentId, p))
    .find((key) => circuit.wires.some((w) => isEndpoint(w, key)));
  if (!anodeKey) {
    throw new Error(
      `resolveLedPin: LED "${ledComponentId}" has no wired anode pin (${anodeNames.join('/')}).`,
    );
  }

  const boardIds = new Set(circuit.boards.map((b) => b.id));
  const candidates: number[] = [];
  for (const w of circuit.wires) {
    for (const ep of [w.start, w.end]) {
      if (!boardIds.has(ep.componentId)) continue;
      if (GROUND_PIN_RE.test(ep.pinName) || VCC_PIN_RE.test(ep.pinName)) continue;
      const pinNo = digitalPinNumber(ep.pinName);
      if (pinNo == null) continue;
      if (uf.connected(pinKey(ep.componentId, ep.pinName), anodeKey)) candidates.push(pinNo);
    }
  }

  const unique = [...new Set(candidates)];
  if (unique.length === 0) {
    throw new Error(
      `resolveLedPin: LED "${ledComponentId}" anode is not connected to any MCU digital pin.`,
    );
  }
  if (unique.length > 1) {
    throw new Error(
      `resolveLedPin: LED "${ledComponentId}" anode resolves to multiple pins (${unique.join(', ')}); ` +
        `wiring is ambiguous.`,
    );
  }
  return unique[0];
}

/** Distinct pin names referenced by wires for a given component. */
function pinsOnComponent(circuit: CircuitProject, componentId: string): string[] {
  const pins = new Set<string>();
  for (const w of circuit.wires) {
    if (w.start.componentId === componentId) pins.add(w.start.pinName);
    if (w.end.componentId === componentId) pins.add(w.end.pinName);
  }
  return [...pins];
}

function isEndpoint(wire: CircuitProject['wires'][number], key: string): boolean {
  return (
    pinKey(wire.start.componentId, wire.start.pinName) === key ||
    pinKey(wire.end.componentId, wire.end.pinName) === key
  );
}
