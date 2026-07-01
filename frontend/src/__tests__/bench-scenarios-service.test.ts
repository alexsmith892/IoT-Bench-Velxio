import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BenchScenarioNotFoundError,
  fetchInspectionScenario,
  listInspectionScenarios,
} from '../services/benchScenariosService';

vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return {
    default: {
      ...actual.default,
      get: vi.fn(),
      isAxiosError: actual.default.isAxiosError,
    },
  };
});

const mockedGet = vi.mocked(axios.get);

describe('benchScenariosService', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('lists scenario summaries from the runtime API', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { scenarios: [{ id: 'uno-led-blink', title: 'Arduino Uno LED Blink' }] },
    });

    await expect(listInspectionScenarios()).resolves.toEqual([
      { id: 'uno-led-blink', title: 'Arduino Uno LED Blink' },
    ]);
    expect(mockedGet).toHaveBeenCalledWith('/api/bench/scenarios');
  });

  it('fetches and validates a scenario payload', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        id: 'uno-led-blink',
        title: 'Arduino Uno LED Blink',
        project: {
          format: 'velxio-project',
          version: 1,
          exportedAt: '2026-06-29T00:00:00.000Z',
          boards: [
            {
              id: 'arduino-uno',
              boardKind: 'arduino-uno',
              x: 50,
              y: 50,
              activeFileGroupId: 'group-arduino-uno',
            },
          ],
          fileGroups: {
            'group-arduino-uno': [{ name: 'sketch.ino', content: 'void setup() {}' }],
          },
          components: [
            {
              id: 'bench_led',
              metadataId: 'led',
              x: 430,
              y: 110,
              properties: { color: 'red' },
            },
            {
              id: 'bench_resistor',
              metadataId: 'resistor',
              x: 290,
              y: 140,
              properties: { value: '220' },
            },
          ],
          wires: [
            {
              id: 'bench_wire_pin13',
              start: { componentId: 'arduino-uno', pinName: '13', x: 0, y: 0 },
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
          ],
          activeBoardId: 'arduino-uno',
        },
      },
    });

    const scenario = await fetchInspectionScenario('uno-led-blink');
    expect(scenario.id).toBe('uno-led-blink');
    expect(scenario.taskMonitor.probes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: 'pinEdges', pin: 13 }),
        expect.objectContaining({ channel: 'serial' }),
      ]),
    );
  });

  it('maps API 404 responses to BenchScenarioNotFoundError', async () => {
    mockedGet.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 404, data: { detail: 'Run export:inspection first.' } },
    });

    const rejection = fetchInspectionScenario('missing');
    await expect(rejection).rejects.toBeInstanceOf(BenchScenarioNotFoundError);
    await expect(rejection).rejects.toThrow('Run export:inspection first.');
  });
});
