import type { CircuitProject } from '../types';

/**
 * `potentiometer_pwm_map` circuit (single source of truth): a potentiometer on A1
 * and a PWM LED (D3 → 220Ω → LED → GND). The harness injects the A1 voltage and
 * grades the D3 PWM duty directly; the components make both visible in the monitor.
 */
export const BENCH_GROUP_ID = 'group-arduino-uno';

export function buildProject(sketch: string): CircuitProject {
  return {
    format: 'velxio-project',
    version: 1,
    exportedAt: '2026-06-30T00:00:00.000Z',
    name: 'Potentiometer PWM Map',
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
      { id: 'bench_pot', metadataId: 'potentiometer', x: 380, y: 210, properties: { value: 512 } },
      { id: 'bench_led', metadataId: 'led', x: 440, y: 90, properties: { color: 'yellow' } },
      { id: 'bench_resistor', metadataId: 'resistor', x: 300, y: 110, properties: { value: '220' } },
    ],
    wires: [
      {
        id: 'bench_wire_pwm',
        start: { componentId: 'arduino-uno', pinName: '3', x: 0, y: 0 },
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
        end: { componentId: 'arduino-uno', pinName: 'GND.1', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
      {
        id: 'bench_wire_pot_sig',
        start: { componentId: 'bench_pot', pinName: 'SIG', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'A1', x: 0, y: 0 },
        waypoints: [],
        color: '#f59e0b',
      },
      {
        id: 'bench_wire_pot_vcc',
        start: { componentId: 'bench_pot', pinName: 'VCC', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: '5V', x: 0, y: 0 },
        waypoints: [],
        color: '#ef4444',
      },
      {
        id: 'bench_wire_pot_gnd',
        start: { componentId: 'bench_pot', pinName: 'GND', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.2', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
    ],
    activeBoardId: 'arduino-uno',
  };
}
