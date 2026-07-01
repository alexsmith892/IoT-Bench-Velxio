import type { CircuitProject } from '../types';

/**
 * `serial_control_protocol` circuit (single source of truth): an active-high LED on
 * D7 and a PWM LED on D3, each D-pin → 220Ω → LED anode, cathode → GND. Commands
 * arrive over serial (RX); the grader injects them and checks the driven D7 level,
 * the D3 PWM duty, and the decoded TX replies. The LEDs make both outputs visible in
 * the monitor.
 */
export const BENCH_GROUP_ID = 'group-arduino-uno';

export function buildProject(sketch: string): CircuitProject {
  return {
    format: 'velxio-project',
    version: 1,
    exportedAt: '2026-06-30T00:00:00.000Z',
    name: 'Serial Control Protocol',
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
      { id: 'bench_res_led', metadataId: 'resistor', x: 300, y: 90, properties: { value: '220' } },
      { id: 'bench_pwm', metadataId: 'led', x: 440, y: 170, properties: { color: 'yellow' } },
      { id: 'bench_res_pwm', metadataId: 'resistor', x: 300, y: 170, properties: { value: '220' } },
    ],
    wires: [
      {
        id: 'bench_wire_led',
        start: { componentId: 'arduino-uno', pinName: '7', x: 0, y: 0 },
        end: { componentId: 'bench_res_led', pinName: '1', x: 0, y: 0 },
        waypoints: [],
        color: '#ef4444',
      },
      {
        id: 'bench_wire_led_anode',
        start: { componentId: 'bench_res_led', pinName: '2', x: 0, y: 0 },
        end: { componentId: 'bench_led', pinName: 'A', x: 0, y: 0 },
        waypoints: [],
        color: '#ef4444',
      },
      {
        id: 'bench_wire_led_cathode',
        start: { componentId: 'bench_led', pinName: 'C', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.1', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
      {
        id: 'bench_wire_pwm',
        start: { componentId: 'arduino-uno', pinName: '3', x: 0, y: 0 },
        end: { componentId: 'bench_res_pwm', pinName: '1', x: 0, y: 0 },
        waypoints: [],
        color: '#eab308',
      },
      {
        id: 'bench_wire_pwm_anode',
        start: { componentId: 'bench_res_pwm', pinName: '2', x: 0, y: 0 },
        end: { componentId: 'bench_pwm', pinName: 'A', x: 0, y: 0 },
        waypoints: [],
        color: '#eab308',
      },
      {
        id: 'bench_wire_pwm_cathode',
        start: { componentId: 'bench_pwm', pinName: 'C', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.2', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
    ],
    activeBoardId: 'arduino-uno',
  };
}
