import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = resolve(root, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('monitor/grader dependency boundary', () => {
  it('keeps deterministic grader modules independent from frontend monitor code', () => {
    const benchRoot = resolve(import.meta.dirname, '../../../bench');
    const runtimeRoots = ['contracts', 'gate', 'harness', 'runner', 'tasks'].map((folder) =>
      resolve(benchRoot, folder),
    );
    const violations = runtimeRoots.flatMap(sourceFiles).filter((path) => {
      const source = readFileSync(path, 'utf8');
      const imports = [...source.matchAll(/(?:from\s+|import\()\s*['"]([^'"]+)/g)].map(
        (match) => match[1],
      );
      return imports.some(
        (specifier) =>
          specifier.includes('frontend/src') ||
          specifier.includes('TaskMonitor') ||
          specifier.includes('simulationTelemetry'),
      );
    });
    expect(violations).toEqual([]);
  });
});
