/**
 * Pass 1 success criterion: `uno-led-blink` loads through the new
 * `OneShotScenario` schema (and still satisfies the runtime `BenchTask` shape).
 * Pure Node — reads the sketch via fs + builds the circuit; no backend needed.
 */
import { describe, it, expect } from 'vitest';
import scenario from '../../../tasks/uno-led-blink/task';
import { getTask } from '../../../tasks/registry';

describe('OneShotScenario: uno-led-blink', () => {
  it('populates the public/reporting metadata fields', () => {
    expect(scenario.id).toBe('uno-led-blink');
    expect(scenario.difficulty).toBe('D1');
    expect(scenario.tiers).toContain('A');
    expect(typeof scenario.domain).toBe('string');
    expect(scenario.prompt.length).toBeGreaterThan(0);
    expect(scenario.libraries).toEqual([]);
    expect(scenario.referenceSolution).toEqual(['sketch.ino']);
    expect(Array.isArray(scenario.adversarialWrongs)).toBe(true);
    expect(Array.isArray(scenario.variants)).toBe(true);
  });

  it('still satisfies the runtime BenchTask shape', () => {
    expect(scenario.board).toBe('arduino:avr:uno');
    expect(scenario.runMs).toBeGreaterThan(0);
    expect(scenario.contract.length).toBeGreaterThan(0);
    expect(scenario.circuit.format).toBe('velxio-project');
    expect(scenario.referenceFirmware[0].name).toBe('sketch.ino');
    expect(scenario.referenceFirmware[0].content).toContain('loop');
  });

  it('is resolvable through the registry', () => {
    expect(getTask('uno-led-blink')).toBe(scenario);
    expect(getTask('nope')).toBeUndefined();
  });
});
