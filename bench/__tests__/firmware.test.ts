/**
 * `readSketchFiles` makes scenario file PATHS the single source of truth for
 * firmware content (Pass 1 reflection §8.2, resolved). Pure Node, no backend.
 */
import { describe, it, expect } from 'vitest';
import { readSketchFiles } from '../scenarios/firmware';

const SCENARIO_DIR = new URL('../scenarios/uno-led-blink/', import.meta.url);

describe('readSketchFiles', () => {
  it('reads each relative path into a SketchFile with name + content', () => {
    const files = readSketchFiles(SCENARIO_DIR, ['sketch.ino']);
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('sketch.ino');
    expect(files[0].content).toContain('void loop');
  });

  it('throws on a missing path rather than returning empty content', () => {
    expect(() => readSketchFiles(SCENARIO_DIR, ['does-not-exist.ino'])).toThrow();
  });
});
