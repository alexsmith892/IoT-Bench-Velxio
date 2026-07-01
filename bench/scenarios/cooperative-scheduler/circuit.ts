import type { CircuitProject } from '../types';

/**
 * `cooperative_scheduler` circuit (single source of truth): four active-high LEDs
 * on D4/D5/D6/D7, a mode button on D2, and a response LED on D8. The grader reads
 * the driven pin levels directly (per-LED frequency, D8 mirror), so the components
 * are for monitor visibility only.
 */
export const BENCH_GROUP_ID = 'group-arduino-uno';

const led = (id: string, x: number, y: number, color: string) => [
  { id: `${id}_r`, metadataId: 'resistor', x: x - 140, y, properties: { value: '220' } },
  { id, metadataId: 'led', x, y, properties: { color } },
];

const ledWires = (id: string, pin: string, gnd: string, color: string) => [
  {
    id: `w_${id}_a`,
    start: { componentId: 'arduino-uno', pinName: pin, x: 0, y: 0 },
    end: { componentId: `${id}_r`, pinName: '1', x: 0, y: 0 },
    waypoints: [],
    color,
  },
  {
    id: `w_${id}_b`,
    start: { componentId: `${id}_r`, pinName: '2', x: 0, y: 0 },
    end: { componentId: id, pinName: 'A', x: 0, y: 0 },
    waypoints: [],
    color,
  },
  {
    id: `w_${id}_c`,
    start: { componentId: id, pinName: 'C', x: 0, y: 0 },
    end: { componentId: 'arduino-uno', pinName: gnd, x: 0, y: 0 },
    waypoints: [],
    color: '#000000',
  },
];

export function buildProject(sketch: string): CircuitProject {
  return {
    format: 'velxio-project',
    version: 1,
    exportedAt: '2026-07-01T00:00:00.000Z',
    name: 'Cooperative Scheduler',
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
      ...led('led_a', 400, 60, 'red'),
      ...led('led_b', 400, 130, 'green'),
      ...led('led_c', 400, 200, 'blue'),
      ...led('led_d', 400, 270, 'yellow'),
      { id: 'bench_button', metadataId: 'pushbutton', x: 400, y: 350, properties: {} },
      ...led('led_resp', 400, 430, 'white'),
    ],
    wires: [
      ...ledWires('led_a', '4', 'GND.1', '#ef4444'),
      ...ledWires('led_b', '5', 'GND.2', '#22c55e'),
      ...ledWires('led_c', '6', 'GND.3', '#3b82f6'),
      ...ledWires('led_d', '7', 'GND.1', '#eab308'),
      {
        id: 'w_btn',
        start: { componentId: 'arduino-uno', pinName: '2', x: 0, y: 0 },
        end: { componentId: 'bench_button', pinName: '1.l', x: 0, y: 0 },
        waypoints: [],
        color: '#a855f7',
      },
      {
        id: 'w_btn_gnd',
        start: { componentId: 'bench_button', pinName: '2.l', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.2', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
      ...ledWires('led_resp', '8', 'GND.3', '#e5e7eb'),
    ],
    activeBoardId: 'arduino-uno',
  };
}
