import { describe, it, expect } from 'vitest';
import { buildProject } from '../scenarios/uno-led-blink/circuit';
import { resolveLedPin } from '../contracts/ledPinResolver';
import type { CircuitProject } from '../scenarios/types';

describe('resolveLedPin', () => {
  const circuit = buildProject('// firmware text is irrelevant to wiring');

  it('resolves the LED to pin 13 by walking wires through the resistor', () => {
    expect(resolveLedPin(circuit, 'bench_led')).toBe(13);
  });

  it('is board/pin-agnostic — follows wiring when the LED moves to pin 9', () => {
    const moved: CircuitProject = {
      ...circuit,
      wires: circuit.wires.map((w) =>
        w.id === 'bench_wire_pin13'
          ? { ...w, start: { ...w.start, pinName: '9' } }
          : w,
      ),
    };
    expect(resolveLedPin(moved, 'bench_led')).toBe(9);
  });

  it('still resolves with extra unrelated peripherals on the board', () => {
    const multi: CircuitProject = {
      ...circuit,
      components: [
        ...circuit.components,
        { id: 'extra_btn', metadataId: 'pushbutton', x: 0, y: 0, properties: {} },
      ],
      wires: [
        ...circuit.wires,
        {
          id: 'btn_wire',
          start: { componentId: 'arduino-uno', pinName: '2', x: 0, y: 0 },
          end: { componentId: 'extra_btn', pinName: '1.l', x: 0, y: 0 },
          color: '#fff',
        },
      ],
    };
    expect(resolveLedPin(multi, 'bench_led')).toBe(13);
  });

  it('throws when the LED component is missing', () => {
    expect(() => resolveLedPin(circuit, 'nope')).toThrow(/no component/);
  });
});
