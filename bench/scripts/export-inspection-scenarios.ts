/**
 * Export inspection scenarios from the TypeScript registry to JSON for the
 * runtime bench API (Docker/production). Run after adding scenarios:
 *   npm run export:inspection
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

register('./raw-hook.mjs', import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '../inspection-export/scenarios.json');

const { inspectionScenarios } = await import('../inspection-scenarios/registry.ts');

const payload = {
  version: 1,
  exportedAt: new Date().toISOString(),
  scenarios: inspectionScenarios,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Wrote ${inspectionScenarios.length} scenario(s) to ${outPath}`);
