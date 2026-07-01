import type { CircuitProject } from '../types';

/**
 * `servo_slew_position` circuit (single source of truth): a hobby servo on D9. The
 * grader reads the D9 pulse train directly (HIGH-width → angle), so the servo
 * component is for monitor visibility only.
 */
export const BENCH_GROUP_ID = 'group-arduino-uno';

export function buildProject(sketch: string): CircuitProject {
  return {
    format: 'velxio-project',
    version: 1,
    exportedAt: '2026-07-01T00:00:00.000Z',
    name: 'Servo Slew Position',
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
      { id: 'bench_servo', metadataId: 'servo', x: 380, y: 120, properties: {} },
    ],
    wires: [
      {
        id: 'bench_wire_sig',
        start: { componentId: 'arduino-uno', pinName: '9', x: 0, y: 0 },
        end: { componentId: 'bench_servo', pinName: 'PWM', x: 0, y: 0 },
        waypoints: [],
        color: '#f59e0b',
      },
      {
        id: 'bench_wire_vcc',
        start: { componentId: 'arduino-uno', pinName: '5V', x: 0, y: 0 },
        end: { componentId: 'bench_servo', pinName: 'V+', x: 0, y: 0 },
        waypoints: [],
        color: '#ef4444',
      },
      {
        id: 'bench_wire_gnd',
        start: { componentId: 'bench_servo', pinName: 'GND', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.1', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
    ],
    activeBoardId: 'arduino-uno',
  };
}
