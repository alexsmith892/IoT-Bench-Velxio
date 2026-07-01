import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Vite-style `?raw` imports for Node/tsx (inspection registry sketch loading). */
export async function load(url, context, nextLoad) {
  if (!url.endsWith('?raw')) {
    return nextLoad(url, context);
  }
  const fileUrl = url.slice(0, -'?raw'.length);
  const source = readFileSync(fileURLToPath(fileUrl), 'utf8');
  return {
    format: 'module',
    source: `export default ${JSON.stringify(source)};`,
    shortCircuit: true,
  };
}
