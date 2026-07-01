import type { CircuitProject } from '../types';

/**
 * `binary_framed_protocol` circuit (single source of truth): an active-high LED on
 * D7 and a PWM LED on D3. The grader reads the binary serial responses plus the D7
 * level and D3 duty directly, so the components are for monitor visibility only.
 */
export const BENCH_GROUP_ID = 'group-arduino-uno';

export function buildProject(sketch: string): CircuitProject {
  return {
    format: 'velxio-project',
    version: 1,
    exportedAt: '2026-07-01T00:00:00.000Z',
    name: 'Binary Framed Protocol',
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
      { id: 'bench_led', metadataId: 'led', x: 440, y: 90, properties: { color: 'red' } },
      { id: 'bench_led_r', metadataId: 'resistor', x: 300, y: 90, properties: { value: '220' } },
      { id: 'bench_pwm', metadataId: 'led', x: 440, y: 200, properties: { color: 'blue' } },
      { id: 'bench_pwm_r', metadataId: 'resistor', x: 300, y: 200, properties: { value: '220' } },
    ],
    wires: [
      {
        id: 'w_led',
        start: { componentId: 'arduino-uno', pinName: '7', x: 0, y: 0 },
        end: { componentId: 'bench_led_r', pinName: '1', x: 0, y: 0 },
        waypoints: [],
        color: '#ef4444',
      },
      {
        id: 'w_led_a',
        start: { componentId: 'bench_led_r', pinName: '2', x: 0, y: 0 },
        end: { componentId: 'bench_led', pinName: 'A', x: 0, y: 0 },
        waypoints: [],
        color: '#ef4444',
      },
      {
        id: 'w_led_c',
        start: { componentId: 'bench_led', pinName: 'C', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.1', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
      {
        id: 'w_pwm',
        start: { componentId: 'arduino-uno', pinName: '3', x: 0, y: 0 },
        end: { componentId: 'bench_pwm_r', pinName: '1', x: 0, y: 0 },
        waypoints: [],
        color: '#3b82f6',
      },
      {
        id: 'w_pwm_a',
        start: { componentId: 'bench_pwm_r', pinName: '2', x: 0, y: 0 },
        end: { componentId: 'bench_pwm', pinName: 'A', x: 0, y: 0 },
        waypoints: [],
        color: '#3b82f6',
      },
      {
        id: 'w_pwm_c',
        start: { componentId: 'bench_pwm', pinName: 'C', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.2', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
    ],
    activeBoardId: 'arduino-uno',
  };
}
