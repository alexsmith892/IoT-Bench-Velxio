/**
 * Resolve a scenario's firmware files from disk. Makes the declared file PATHS
 * the single source of truth: a scenario lists `referenceSolution` (and later
 * `adversarialWrongs`) as paths, and the runtime `SketchFile[]` content is read
 * from those paths here — never hand-copied into the manifest, so the two cannot
 * drift (Pass 1 reflection §8.2, resolved).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { SketchFile } from '../compile/compileClient';

/**
 * Read sketch files for a scenario.
 *
 * @param dirUrl  the scenario directory as a URL — MUST end with `/` (e.g.
 *                `new URL('../../scenarios/uno-led-blink/', import.meta.url)`).
 * @param relPaths paths relative to `dirUrl` (e.g. `['sketch.ino']`).
 * @returns one `SketchFile` per path; `name` is the relative path, `content`
 *          the file text. The backend promotes the first `.ino` to `sketch.ino`.
 */
export function readSketchFiles(dirUrl: URL, relPaths: string[]): SketchFile[] {
  return relPaths.map((rel) => ({
    name: rel,
    content: readFileSync(fileURLToPath(new URL(rel, dirUrl)), 'utf8'),
  }));
}
