import type { CircuitProject } from '../types';

/**
 * `reaction_timer_fsm` circuit (single source of truth): a START button on D2, a
 * STOP button on D3 (both to GND, firmware uses INPUT_PULLUP), and an active-high
 * cue LED on D8 (via 220Ω). The grader drives the buttons and reads the D8 level +
 * the decoded serial (FALSE_START / REACTION_MS=n).
 */
export const BENCH_GROUP_ID = 'group-arduino-uno';

export function buildProject(sketch: string): CircuitProject {
  return {
    format: 'velxio-project',
    version: 1,
    exportedAt: '2026-06-30T00:00:00.000Z',
    name: 'Reaction Timer FSM',
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
      { id: 'bench_start', metadataId: 'pushbutton', x: 360, y: 200, properties: {} },
      { id: 'bench_stop', metadataId: 'pushbutton', x: 360, y: 280, properties: {} },
      { id: 'bench_led', metadataId: 'led', x: 440, y: 90, properties: { color: 'green' } },
      { id: 'bench_resistor', metadataId: 'resistor', x: 300, y: 90, properties: { value: '220' } },
    ],
    wires: [
      {
        id: 'bench_wire_start',
        start: { componentId: 'arduino-uno', pinName: '2', x: 0, y: 0 },
        end: { componentId: 'bench_start', pinName: '1.l', x: 0, y: 0 },
        waypoints: [],
        color: '#3b82f6',
      },
      {
        id: 'bench_wire_start_gnd',
        start: { componentId: 'bench_start', pinName: '2.l', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.1', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
      {
        id: 'bench_wire_stop',
        start: { componentId: 'arduino-uno', pinName: '3', x: 0, y: 0 },
        end: { componentId: 'bench_stop', pinName: '1.l', x: 0, y: 0 },
        waypoints: [],
        color: '#3b82f6',
      },
      {
        id: 'bench_wire_stop_gnd',
        start: { componentId: 'bench_stop', pinName: '2.l', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.2', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
      {
        id: 'bench_wire_led',
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
