import type { CircuitProject } from '../types';

/**
 * `appliance_cycle_fsm` circuit (single source of truth): a door switch on D2
 * (closed = LOW, INPUT_PULLUP), a START/CANCEL button on D3 (to GND, INPUT_PULLUP),
 * and three active-high stage LEDs — FILL D6, MOTOR D7, DRAIN D8 (each via 220Ω).
 * The grader drives the inputs and reads the driven output levels + the decoded
 * STATE=… serial. The LEDs make the stage outputs visible in the monitor.
 */
export const BENCH_GROUP_ID = 'group-arduino-uno';

export function buildProject(sketch: string): CircuitProject {
  return {
    format: 'velxio-project',
    version: 1,
    exportedAt: '2026-06-30T00:00:00.000Z',
    name: 'Appliance Cycle FSM',
    boards: [
      {
        id: 'arduino-uno',
        boardKind: 'arduino-uno',
        x: 50,
        y: 50,
        activeFileGroupId: BENCH_GROUP_ID,
        languageMode: 'arduino',
        serialBaudRate: 115200,
        libraries: [],
      },
    ],
    fileGroups: { [BENCH_GROUP_ID]: [{ name: 'sketch.ino', content: sketch }] },
    components: [
      { id: 'bench_door', metadataId: 'pushbutton', x: 360, y: 240, properties: {} },
      { id: 'bench_btn', metadataId: 'pushbutton', x: 360, y: 320, properties: {} },
      { id: 'bench_fill', metadataId: 'led', x: 440, y: 60, properties: { color: 'blue' } },
      { id: 'bench_res_fill', metadataId: 'resistor', x: 300, y: 60, properties: { value: '220' } },
      { id: 'bench_motor', metadataId: 'led', x: 440, y: 120, properties: { color: 'green' } },
      { id: 'bench_res_motor', metadataId: 'resistor', x: 300, y: 120, properties: { value: '220' } },
      { id: 'bench_drain', metadataId: 'led', x: 440, y: 180, properties: { color: 'yellow' } },
      { id: 'bench_res_drain', metadataId: 'resistor', x: 300, y: 180, properties: { value: '220' } },
    ],
    wires: [
      // Door switch D2 → GND
      { id: 'w_door', start: { componentId: 'arduino-uno', pinName: '2', x: 0, y: 0 }, end: { componentId: 'bench_door', pinName: '1.l', x: 0, y: 0 }, waypoints: [], color: '#3b82f6' },
      { id: 'w_door_gnd', start: { componentId: 'bench_door', pinName: '2.l', x: 0, y: 0 }, end: { componentId: 'arduino-uno', pinName: 'GND.1', x: 0, y: 0 }, waypoints: [], color: '#000000' },
      // Button D3 → GND
      { id: 'w_btn', start: { componentId: 'arduino-uno', pinName: '3', x: 0, y: 0 }, end: { componentId: 'bench_btn', pinName: '1.l', x: 0, y: 0 }, waypoints: [], color: '#3b82f6' },
      { id: 'w_btn_gnd', start: { componentId: 'bench_btn', pinName: '2.l', x: 0, y: 0 }, end: { componentId: 'arduino-uno', pinName: 'GND.2', x: 0, y: 0 }, waypoints: [], color: '#000000' },
      // FILL D6
      { id: 'w_fill', start: { componentId: 'arduino-uno', pinName: '6', x: 0, y: 0 }, end: { componentId: 'bench_res_fill', pinName: '1', x: 0, y: 0 }, waypoints: [], color: '#3b82f6' },
      { id: 'w_fill_a', start: { componentId: 'bench_res_fill', pinName: '2', x: 0, y: 0 }, end: { componentId: 'bench_fill', pinName: 'A', x: 0, y: 0 }, waypoints: [], color: '#3b82f6' },
      { id: 'w_fill_c', start: { componentId: 'bench_fill', pinName: 'C', x: 0, y: 0 }, end: { componentId: 'arduino-uno', pinName: 'GND.3', x: 0, y: 0 }, waypoints: [], color: '#000000' },
      // MOTOR D7
      { id: 'w_motor', start: { componentId: 'arduino-uno', pinName: '7', x: 0, y: 0 }, end: { componentId: 'bench_res_motor', pinName: '1', x: 0, y: 0 }, waypoints: [], color: '#22c55e' },
      { id: 'w_motor_a', start: { componentId: 'bench_res_motor', pinName: '2', x: 0, y: 0 }, end: { componentId: 'bench_motor', pinName: 'A', x: 0, y: 0 }, waypoints: [], color: '#22c55e' },
      { id: 'w_motor_c', start: { componentId: 'bench_motor', pinName: 'C', x: 0, y: 0 }, end: { componentId: 'arduino-uno', pinName: 'GND.4', x: 0, y: 0 }, waypoints: [], color: '#000000' },
      // DRAIN D8
      { id: 'w_drain', start: { componentId: 'arduino-uno', pinName: '8', x: 0, y: 0 }, end: { componentId: 'bench_res_drain', pinName: '1', x: 0, y: 0 }, waypoints: [], color: '#eab308' },
      { id: 'w_drain_a', start: { componentId: 'bench_res_drain', pinName: '2', x: 0, y: 0 }, end: { componentId: 'bench_drain', pinName: 'A', x: 0, y: 0 }, waypoints: [], color: '#eab308' },
      { id: 'w_drain_c', start: { componentId: 'bench_drain', pinName: 'C', x: 0, y: 0 }, end: { componentId: 'arduino-uno', pinName: 'GND.5', x: 0, y: 0 }, waypoints: [], color: '#000000' },
    ],
    activeBoardId: 'arduino-uno',
  };
}
