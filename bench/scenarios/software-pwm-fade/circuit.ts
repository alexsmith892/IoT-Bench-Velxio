import type { CircuitProject } from '../types';

/**
 * `software_pwm_fade` circuit (single source of truth): an active-high LED on D8
 * (a non-PWM pin) through a 220Ω resistor. The grader reads the D8 waveform
 * directly (software-generated 200 Hz PWM), so the LED is for monitor visibility.
 */
export const BENCH_GROUP_ID = 'group-arduino-uno';

export function buildProject(sketch: string): CircuitProject {
  return {
    format: 'velxio-project',
    version: 1,
    exportedAt: '2026-07-01T00:00:00.000Z',
    name: 'Software PWM Fade',
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
      { id: 'bench_led', metadataId: 'led', x: 440, y: 90, properties: { color: 'yellow' } },
      { id: 'bench_resistor', metadataId: 'resistor', x: 300, y: 90, properties: { value: '220' } },
    ],
    wires: [
      {
        id: 'bench_wire_led',
        start: { componentId: 'arduino-uno', pinName: '8', x: 0, y: 0 },
        end: { componentId: 'bench_resistor', pinName: '1', x: 0, y: 0 },
        waypoints: [],
        color: '#eab308',
      },
      {
        id: 'bench_wire_anode',
        start: { componentId: 'bench_resistor', pinName: '2', x: 0, y: 0 },
        end: { componentId: 'bench_led', pinName: 'A', x: 0, y: 0 },
        waypoints: [],
        color: '#eab308',
      },
      {
        id: 'bench_wire_cathode',
        start: { componentId: 'bench_led', pinName: 'C', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.1', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
    ],
    activeBoardId: 'arduino-uno',
  };
}
