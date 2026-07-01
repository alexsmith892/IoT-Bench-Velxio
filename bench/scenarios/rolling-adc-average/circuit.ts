import type { CircuitProject } from '../types';

/**
 * `rolling_adc_average` circuit (single source of truth). The analog source on A0
 * is a potentiometer — a MONITOR-ONLY stand-in. Grading never reads it: the
 * harness injects the A0 voltage directly (benchmark-design.md §3) and grades the
 * decoded `AVG=` serial value. The potentiometer just gives the inspection monitor
 * a draggable A0 source.
 */
export const BENCH_GROUP_ID = 'group-arduino-uno';

export function buildProject(sketch: string): CircuitProject {
  return {
    format: 'velxio-project',
    version: 1,
    exportedAt: '2026-06-30T00:00:00.000Z',
    name: 'Rolling ADC Average',
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
      { id: 'bench_sensor', metadataId: 'potentiometer', x: 380, y: 200, properties: { value: 512 } },
    ],
    wires: [
      {
        id: 'bench_wire_sig',
        start: { componentId: 'bench_sensor', pinName: 'SIG', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'A0', x: 0, y: 0 },
        waypoints: [],
        color: '#f59e0b',
      },
      {
        id: 'bench_wire_vcc',
        start: { componentId: 'bench_sensor', pinName: 'VCC', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: '5V', x: 0, y: 0 },
        waypoints: [],
        color: '#ef4444',
      },
      {
        id: 'bench_wire_gnd',
        start: { componentId: 'bench_sensor', pinName: 'GND', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.1', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
    ],
    activeBoardId: 'arduino-uno',
  };
}
