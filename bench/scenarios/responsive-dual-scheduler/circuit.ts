import type { CircuitProject } from '../types';

/**
 * `responsive_dual_scheduler` circuit (single source of truth): three active-high
 * LEDs and a button.
 *   - LED A on D3 (blinks 1 Hz), LED B on D5 (blinks 2 Hz), response LED on D8
 *     (mirrors the button), each D-pin → 220Ω → LED anode, cathode → GND.
 *   - pushbutton D2 → GND (firmware uses INPUT_PULLUP).
 * The grader reads the driven pin levels directly (frequency on D3/D5,
 * responsiveness on D8); the LEDs make all three channels visible in the monitor.
 */
export const BENCH_GROUP_ID = 'group-arduino-uno';

export function buildProject(sketch: string): CircuitProject {
  return {
    format: 'velxio-project',
    version: 1,
    exportedAt: '2026-06-30T00:00:00.000Z',
    name: 'Responsive Dual Scheduler',
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
      { id: 'bench_button', metadataId: 'pushbutton', x: 360, y: 300, properties: {} },
      { id: 'bench_led_a', metadataId: 'led', x: 430, y: 80, properties: { color: 'green' } },
      { id: 'bench_res_a', metadataId: 'resistor', x: 300, y: 80, properties: { value: '220' } },
      { id: 'bench_led_b', metadataId: 'led', x: 430, y: 150, properties: { color: 'blue' } },
      { id: 'bench_res_b', metadataId: 'resistor', x: 300, y: 150, properties: { value: '220' } },
      { id: 'bench_led_r', metadataId: 'led', x: 430, y: 220, properties: { color: 'yellow' } },
      { id: 'bench_res_r', metadataId: 'resistor', x: 300, y: 220, properties: { value: '220' } },
    ],
    wires: [
      // Button D2 → GND
      {
        id: 'bench_wire_btn',
        start: { componentId: 'arduino-uno', pinName: '2', x: 0, y: 0 },
        end: { componentId: 'bench_button', pinName: '1.l', x: 0, y: 0 },
        waypoints: [],
        color: '#3b82f6',
      },
      {
        id: 'bench_wire_btn_gnd',
        start: { componentId: 'bench_button', pinName: '2.l', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.1', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
      // LED A on D3
      {
        id: 'bench_wire_a',
        start: { componentId: 'arduino-uno', pinName: '3', x: 0, y: 0 },
        end: { componentId: 'bench_res_a', pinName: '1', x: 0, y: 0 },
        waypoints: [],
        color: '#22c55e',
      },
      {
        id: 'bench_wire_a_anode',
        start: { componentId: 'bench_res_a', pinName: '2', x: 0, y: 0 },
        end: { componentId: 'bench_led_a', pinName: 'A', x: 0, y: 0 },
        waypoints: [],
        color: '#22c55e',
      },
      {
        id: 'bench_wire_a_cathode',
        start: { componentId: 'bench_led_a', pinName: 'C', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.2', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
      // LED B on D5
      {
        id: 'bench_wire_b',
        start: { componentId: 'arduino-uno', pinName: '5', x: 0, y: 0 },
        end: { componentId: 'bench_res_b', pinName: '1', x: 0, y: 0 },
        waypoints: [],
        color: '#3b82f6',
      },
      {
        id: 'bench_wire_b_anode',
        start: { componentId: 'bench_res_b', pinName: '2', x: 0, y: 0 },
        end: { componentId: 'bench_led_b', pinName: 'A', x: 0, y: 0 },
        waypoints: [],
        color: '#3b82f6',
      },
      {
        id: 'bench_wire_b_cathode',
        start: { componentId: 'bench_led_b', pinName: 'C', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.3', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
      // Response LED on D8
      {
        id: 'bench_wire_r',
        start: { componentId: 'arduino-uno', pinName: '8', x: 0, y: 0 },
        end: { componentId: 'bench_res_r', pinName: '1', x: 0, y: 0 },
        waypoints: [],
        color: '#eab308',
      },
      {
        id: 'bench_wire_r_anode',
        start: { componentId: 'bench_res_r', pinName: '2', x: 0, y: 0 },
        end: { componentId: 'bench_led_r', pinName: 'A', x: 0, y: 0 },
        waypoints: [],
        color: '#eab308',
      },
      {
        id: 'bench_wire_r_cathode',
        start: { componentId: 'bench_led_r', pinName: 'C', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.4', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
    ],
    activeBoardId: 'arduino-uno',
  };
}
