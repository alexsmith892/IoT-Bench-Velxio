import type { CircuitProject } from '../types';

/**
 * `debounced_toggle` circuit (single source of truth, shared by the headless task
 * and the visual inspection monitor):
 *   - pushbutton D2 → GND (firmware uses INPUT_PULLUP): released=HIGH, pressed=LOW
 *   - D7 → 220Ω → LED anode, LED cathode → GND. The LED is "active-low" in the
 *     prompt (LOW = on); the grader checks the D7 pin level directly, so the
 *     monitor simply shows the driven D7 level.
 */
export const BENCH_GROUP_ID = 'group-arduino-uno';

export function buildProject(sketch: string): CircuitProject {
  return {
    format: 'velxio-project',
    version: 1,
    exportedAt: '2026-06-30T00:00:00.000Z',
    name: 'Debounced Toggle',
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
      { id: 'bench_button', metadataId: 'pushbutton', x: 360, y: 210, properties: {} },
      { id: 'bench_led', metadataId: 'led', x: 430, y: 90, properties: { color: 'red' } },
      { id: 'bench_resistor', metadataId: 'resistor', x: 295, y: 120, properties: { value: '220' } },
    ],
    wires: [
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
      {
        id: 'bench_wire_pin7',
        start: { componentId: 'arduino-uno', pinName: '7', x: 0, y: 0 },
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
        end: { componentId: 'arduino-uno', pinName: 'GND.2', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
    ],
    activeBoardId: 'arduino-uno',
  };
}
