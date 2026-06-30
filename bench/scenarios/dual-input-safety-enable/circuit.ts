import type { CircuitProject } from '../types';

/**
 * `dual_input_safety_enable` circuit (single source of truth): two pushbuttons to
 * ground on D4/D5 (firmware uses INPUT_PULLUP) and an ENABLE LED indicator on D8
 * through a 220Ω resistor. The grader checks the D8 pin level directly; the LED
 * just makes the ENABLE output visible in the monitor.
 */
export const BENCH_GROUP_ID = 'group-arduino-uno';

export function buildProject(sketch: string): CircuitProject {
  return {
    format: 'velxio-project',
    version: 1,
    exportedAt: '2026-06-30T00:00:00.000Z',
    name: 'Dual-Input Safety Enable',
    boards: [
      {
        id: 'arduino-uno',
        boardKind: 'arduino-uno',
        x: 50,
        y: 50,
        activeFileGroupId: BENCH_GROUP_ID,
        languageMode: 'arduino',
        serialBaudRate: 0,
        libraries: [],
      },
    ],
    fileGroups: { [BENCH_GROUP_ID]: [{ name: 'sketch.ino', content: sketch }] },
    components: [
      { id: 'bench_sw1', metadataId: 'pushbutton', x: 360, y: 170, properties: {} },
      { id: 'bench_sw2', metadataId: 'pushbutton', x: 360, y: 250, properties: {} },
      { id: 'bench_led', metadataId: 'led', x: 440, y: 90, properties: { color: 'green' } },
      { id: 'bench_resistor', metadataId: 'resistor', x: 300, y: 110, properties: { value: '220' } },
    ],
    wires: [
      {
        id: 'bench_wire_sw1',
        start: { componentId: 'arduino-uno', pinName: '4', x: 0, y: 0 },
        end: { componentId: 'bench_sw1', pinName: '1.l', x: 0, y: 0 },
        waypoints: [],
        color: '#3b82f6',
      },
      {
        id: 'bench_wire_sw1_gnd',
        start: { componentId: 'bench_sw1', pinName: '2.l', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.1', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
      {
        id: 'bench_wire_sw2',
        start: { componentId: 'arduino-uno', pinName: '5', x: 0, y: 0 },
        end: { componentId: 'bench_sw2', pinName: '1.l', x: 0, y: 0 },
        waypoints: [],
        color: '#3b82f6',
      },
      {
        id: 'bench_wire_sw2_gnd',
        start: { componentId: 'bench_sw2', pinName: '2.l', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.2', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
      {
        id: 'bench_wire_pin8',
        start: { componentId: 'arduino-uno', pinName: '8', x: 0, y: 0 },
        end: { componentId: 'bench_resistor', pinName: '1', x: 0, y: 0 },
        waypoints: [],
        color: '#22c55e',
      },
      {
        id: 'bench_wire_anode',
        start: { componentId: 'bench_resistor', pinName: '2', x: 0, y: 0 },
        end: { componentId: 'bench_led', pinName: 'A', x: 0, y: 0 },
        waypoints: [],
        color: '#22c55e',
      },
      {
        id: 'bench_wire_cathode',
        start: { componentId: 'bench_led', pinName: 'C', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.3', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
    ],
    activeBoardId: 'arduino-uno',
  };
}
