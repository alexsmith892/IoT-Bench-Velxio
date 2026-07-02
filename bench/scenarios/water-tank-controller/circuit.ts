import type { CircuitProject } from '../types';

export const BENCH_GROUP_ID = 'group-arduino-uno';

export function buildProject(sketch: string): CircuitProject {
  return {
    format: 'velxio-project',
    version: 1,
    exportedAt: '2026-07-01T00:00:00.000Z',
    name: 'Water Tank Controller',
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
      { id: 'level_sensor', metadataId: 'potentiometer', x: 200, y: 120, properties: {} },
      { id: 'silence_btn', metadataId: 'pushbutton', x: 360, y: 210, properties: {} },
    ],
    wires: [
      {
        id: 'w_level_sig',
        start: { componentId: 'level_sensor', pinName: 'SIG', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'A0', x: 0, y: 0 },
        waypoints: [],
        color: '#f59e0b',
      },
      {
        id: 'w_level_vcc',
        start: { componentId: 'level_sensor', pinName: 'VCC', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: '5V', x: 0, y: 0 },
        waypoints: [],
        color: '#ef4444',
      },
      {
        id: 'w_level_gnd',
        start: { componentId: 'level_sensor', pinName: 'GND', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.2', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
      {
        id: 'w_silence',
        start: { componentId: 'arduino-uno', pinName: '2', x: 0, y: 0 },
        end: { componentId: 'silence_btn', pinName: '1.l', x: 0, y: 0 },
        waypoints: [],
        color: '#3b82f6',
      },
      {
        id: 'w_silence_gnd',
        start: { componentId: 'silence_btn', pinName: '2.l', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.1', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
    ],
    activeBoardId: 'arduino-uno',
  };
}
