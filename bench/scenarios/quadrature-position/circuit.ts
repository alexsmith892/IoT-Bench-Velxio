import type { CircuitProject } from '../types';

/**
 * `quadrature_position` circuit (single source of truth): a rotary encoder's A/B
 * channels on D2/D3 (INPUT_PULLUP), driven by the harness. The grader reads the
 * decoded serial output; the encoder component is for monitor visibility only.
 */
export const BENCH_GROUP_ID = 'group-arduino-uno';

export function buildProject(sketch: string): CircuitProject {
  return {
    format: 'velxio-project',
    version: 1,
    exportedAt: '2026-07-01T00:00:00.000Z',
    name: 'Quadrature Position',
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
      { id: 'bench_enc_a', metadataId: 'pushbutton', x: 360, y: 120, properties: {} },
      { id: 'bench_enc_b', metadataId: 'pushbutton', x: 360, y: 260, properties: {} },
    ],
    wires: [
      {
        id: 'w_a',
        start: { componentId: 'arduino-uno', pinName: '2', x: 0, y: 0 },
        end: { componentId: 'bench_enc_a', pinName: '1.l', x: 0, y: 0 },
        waypoints: [],
        color: '#3b82f6',
      },
      {
        id: 'w_a_gnd',
        start: { componentId: 'bench_enc_a', pinName: '2.l', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.1', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
      {
        id: 'w_b',
        start: { componentId: 'arduino-uno', pinName: '3', x: 0, y: 0 },
        end: { componentId: 'bench_enc_b', pinName: '1.l', x: 0, y: 0 },
        waypoints: [],
        color: '#22c55e',
      },
      {
        id: 'w_b_gnd',
        start: { componentId: 'bench_enc_b', pinName: '2.l', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.2', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
    ],
    activeBoardId: 'arduino-uno',
  };
}
