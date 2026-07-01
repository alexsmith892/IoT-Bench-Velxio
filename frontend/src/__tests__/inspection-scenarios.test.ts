import { beforeAll, describe, expect, it } from 'vitest';
import { inspectionScenarios as fixtureScenarios } from '../../../bench/inspection-scenarios/registry';
import {
  deriveDefaultTaskMonitor,
  findInspectionScenario,
  validateInspectionScenarios,
  type InspectionScenario,
} from '../lib/inspectionScenarios';
import { shouldHideFileTabs } from '../components/editor/fileTabsVisibility';
import { useEditorStore } from '../store/useEditorStore';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { loadVlxPayload, validateVlxPayload, VlxParseError } from '../utils/vlxFile';

beforeAll(() => {
  // Project loading schedules DOM-dependent wire-position recalculation. The
  // state assertions in this Node test are synchronous and do not need it.
  globalThis.requestAnimationFrame = (() => 1) as typeof requestAnimationFrame;
});

describe('benchmark inspection scenarios', () => {
  it('validates the tracked registry and rejects duplicate ids', () => {
    const scenarios = validateInspectionScenarios(fixtureScenarios);
    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      'uno-led-blink',
      'uno-monitor-channels',
      // Pass 6 — D1 task bank
      'active-low-interlock',
      'dual-input-safety-enable',
      'tmp36-calibrated-report',
      'potentiometer-pwm-map',
      'hex-dip-to-7segment',
      // Pass 7 — D2 timing/analog/numeric task bank
      'debounced-toggle',
      'light-alarm-hysteresis',
      'responsive-dual-scheduler',
      'rolling-adc-average',
      'integer-overflow-accumulator',
    ]);
    expect(scenarios[0]?.taskMonitor).toMatchObject({
      boardId: 'arduino-uno',
      probes: [{ channel: 'pinEdges', pin: 13 }, { channel: 'serial' }],
    });
    expect(scenarios[1]?.taskMonitor.probes.map((probe) => probe.channel)).toEqual([
      'pwm',
      'adc',
      'serial',
    ]);
    expect(findInspectionScenario(scenarios, 'missing')).toBeNull();
    expect(() => validateInspectionScenarios([fixtureScenarios[0], fixtureScenarios[0]])).toThrow(
      /Duplicate/,
    );
  });

  it('rejects monitor metadata that points outside the scenario', () => {
    const scenario = structuredClone(fixtureScenarios[1]);
    if (!scenario.taskMonitor) throw new Error('fixture monitor missing');
    scenario.taskMonitor.boardId = 'missing-board';
    expect(() => validateInspectionScenarios([scenario])).toThrow(/board was not found/);
  });

  it('derives connected GPIO plus serial defaults and rejects invalid explicit probes', () => {
    const project = validateInspectionScenarios([fixtureScenarios[0]])[0].project;
    const monitor = deriveDefaultTaskMonitor(project);
    expect(monitor.probes).toEqual([
      {
        channel: 'pinEdges',
        pin: 13,
        label: 'GPIO 13',
        derive: ['level', 'digitalTiming', 'waveform'],
      },
      { channel: 'serial', label: 'Serial TX', derive: ['log'] },
    ]);

    const invalid = structuredClone(fixtureScenarios[1]);
    if (!invalid.taskMonitor) throw new Error('fixture monitor missing');
    invalid.taskMonitor.probes[0].derive = ['log'];
    expect(() => validateInspectionScenarios([invalid])).toThrow(/derivation/);
  });

  it('loads the Uno smoke fixture into simulator and editor stores', () => {
    const [scenario] = validateInspectionScenarios(fixtureScenarios) as [InspectionScenario];
    loadVlxPayload(scenario.project);

    const simulator = useSimulatorStore.getState();
    const editor = useEditorStore.getState();
    expect(simulator.activeBoardId).toBe('arduino-uno');
    expect(simulator.boards).toHaveLength(1);
    expect(simulator.boards[0]).toMatchObject({ boardKind: 'arduino-uno', running: false });
    expect(simulator.components.map((component) => component.metadataId)).toEqual([
      'led',
      'resistor',
    ]);
    expect(simulator.wires).toHaveLength(3);
    expect(editor.files).toHaveLength(1);
    expect(editor.files[0]?.name).toBe('sketch.ino');
    expect(editor.files[0]?.content).toContain('constexpr int LED_PIN = 13');
  });

  it('rejects malformed project payloads', () => {
    expect(() => validateVlxPayload({ format: 'velxio-project', version: 1 })).toThrow(
      VlxParseError,
    );
  });

  it('hides only an inspection-scoped single-file tab strip', () => {
    expect(shouldHideFileTabs(true, 1)).toBe(true);
    expect(shouldHideFileTabs(true, 2)).toBe(false);
    expect(shouldHideFileTabs(false, 1)).toBe(false);
  });
});

describe('runtime bench export JSON', () => {
  it('validates the exported inspection scenarios file', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const exportPath = resolve(__dirname, '../../../bench/inspection-export/scenarios.json');
    const payload = JSON.parse(readFileSync(exportPath, 'utf8')) as { scenarios: unknown[] };
    const scenarios = validateInspectionScenarios(payload.scenarios);
    expect(scenarios.length).toBeGreaterThan(0);
    expect(scenarios.map((scenario) => scenario.id)).toEqual(
      validateInspectionScenarios(fixtureScenarios).map((scenario) => scenario.id),
    );
  });
});
