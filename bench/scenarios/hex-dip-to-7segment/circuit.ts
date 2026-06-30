import type { CircuitProject } from '../types';

/**
 * `hex_dip_to_7segment` circuit (single source of truth): four pushbuttons stand
 * in for the DIP switches on D2..D5 (firmware uses INPUT_PULLUP), and a common-
 * cathode seven-segment display on D6..D12 (segments a..g). The grader checks the
 * D6..D12 pin levels directly; the display just renders the glyph in the monitor.
 */
export const BENCH_GROUP_ID = 'group-arduino-uno';

const SW_PINS = ['2', '3', '4', '5'];
const SEG = [
  { pin: '6', seg: 'A' },
  { pin: '7', seg: 'B' },
  { pin: '8', seg: 'C' },
  { pin: '9', seg: 'D' },
  { pin: '10', seg: 'E' },
  { pin: '11', seg: 'F' },
  { pin: '12', seg: 'G' },
];

export function buildProject(sketch: string): CircuitProject {
  const components: CircuitProject['components'] = [
    { id: 'bench_seg', metadataId: '7segment', x: 470, y: 110, properties: { common: 'cathode' } },
  ];
  const wires: CircuitProject['wires'] = [];

  SW_PINS.forEach((pin, i) => {
    const id = `bench_sw${i}`;
    components.push({ id, metadataId: 'pushbutton', x: 340, y: 150 + i * 70, properties: {} });
    wires.push({
      id: `bench_wire_sw${i}`,
      start: { componentId: 'arduino-uno', pinName: pin, x: 0, y: 0 },
      end: { componentId: id, pinName: '1.l', x: 0, y: 0 },
      waypoints: [],
      color: '#3b82f6',
    });
    wires.push({
      id: `bench_wire_sw${i}_gnd`,
      start: { componentId: id, pinName: '2.l', x: 0, y: 0 },
      end: { componentId: 'arduino-uno', pinName: 'GND.1', x: 0, y: 0 },
      waypoints: [],
      color: '#000000',
    });
  });

  for (const { pin, seg } of SEG) {
    wires.push({
      id: `bench_wire_seg_${seg}`,
      start: { componentId: 'arduino-uno', pinName: pin, x: 0, y: 0 },
      end: { componentId: 'bench_seg', pinName: seg, x: 0, y: 0 },
      waypoints: [],
      color: '#22c55e',
    });
  }
  wires.push({
    id: 'bench_wire_seg_com',
    start: { componentId: 'bench_seg', pinName: 'COM', x: 0, y: 0 },
    end: { componentId: 'arduino-uno', pinName: 'GND.2', x: 0, y: 0 },
    waypoints: [],
    color: '#000000',
  });

  return {
    format: 'velxio-project',
    version: 1,
    exportedAt: '2026-06-30T00:00:00.000Z',
    name: 'Hex DIP to 7-Segment',
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
    components,
    wires,
    activeBoardId: 'arduino-uno',
  };
}
