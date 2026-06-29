import { beforeAll, describe, expect, it } from 'vitest';
import { inspectionScenarios as fixtureScenarios } from '../../../bench/inspection-scenarios/registry';
import {
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
    expect(scenarios.map((scenario) => scenario.id)).toEqual(['uno-led-blink']);
    expect(findInspectionScenario(scenarios, 'missing')).toBeNull();
    expect(() => validateInspectionScenarios([fixtureScenarios[0], fixtureScenarios[0]])).toThrow(
      /Duplicate/,
    );
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
