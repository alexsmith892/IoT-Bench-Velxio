import type { CircuitProject } from '../types';

/**
 * `integer_overflow_accumulator` circuit (single source of truth). This task is
 * purely serial (RX commands → TX responses), so the circuit is a bare Uno with no
 * peripherals. The harness injects RX bytes and grades the decoded TX response
 * (benchmark-design.md §3); there is nothing analog or GPIO to show in the monitor
 * beyond the serial log.
 */
export const BENCH_GROUP_ID = 'group-arduino-uno';

export function buildProject(sketch: string): CircuitProject {
  return {
    format: 'velxio-project',
    version: 1,
    exportedAt: '2026-06-30T00:00:00.000Z',
    name: 'Integer Overflow Accumulator',
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
    components: [],
    wires: [],
    activeBoardId: 'arduino-uno',
  };
}
