import type { CircuitProject } from '../types';

export const BENCH_GROUP_ID = 'group-arduino-uno';

export function buildProject(sketch: string): CircuitProject {
  return {
    format: 'velxio-project',
    version: 1,
    exportedAt: '2026-07-01T00:00:00.000Z',
    name: 'Zone Climate Controller',
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
      { id: 'tmp36_z1', metadataId: 'potentiometer', x: 200, y: 120, properties: {} },
      { id: 'tmp36_z2', metadataId: 'potentiometer', x: 200, y: 200, properties: {} },
      { id: 'fault_sw', metadataId: 'pushbutton', x: 360, y: 280, properties: {} },
    ],
    wires: [
      {
        id: 'w_z1_sig',
        start: { componentId: 'tmp36_z1', pinName: 'SIG', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'A0', x: 0, y: 0 },
        waypoints: [],
        color: '#f59e0b',
      },
      {
        id: 'w_z1_vcc',
        start: { componentId: 'tmp36_z1', pinName: 'VCC', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: '5V', x: 0, y: 0 },
        waypoints: [],
        color: '#ef4444',
      },
      {
        id: 'w_z1_gnd',
        start: { componentId: 'tmp36_z1', pinName: 'GND', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.2', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
      {
        id: 'w_z2_sig',
        start: { componentId: 'tmp36_z2', pinName: 'SIG', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'A1', x: 0, y: 0 },
        waypoints: [],
        color: '#f59e0b',
      },
      {
        id: 'w_z2_vcc',
        start: { componentId: 'tmp36_z2', pinName: 'VCC', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: '5V', x: 0, y: 0 },
        waypoints: [],
        color: '#ef4444',
      },
      {
        id: 'w_z2_gnd',
        start: { componentId: 'tmp36_z2', pinName: 'GND', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.3', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
      {
        id: 'w_fault',
        start: { componentId: 'arduino-uno', pinName: '2', x: 0, y: 0 },
        end: { componentId: 'fault_sw', pinName: '1.l', x: 0, y: 0 },
        waypoints: [],
        color: '#3b82f6',
      },
      {
        id: 'w_fault_gnd',
        start: { componentId: 'fault_sw', pinName: '2.l', x: 0, y: 0 },
        end: { componentId: 'arduino-uno', pinName: 'GND.1', x: 0, y: 0 },
        waypoints: [],
        color: '#000000',
      },
    ],
    activeBoardId: 'arduino-uno',
  };
}
