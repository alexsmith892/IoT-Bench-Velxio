// Ambient declaration so `tsc` resolves Vite-style `?raw` text imports used by the
// inspection-scenarios registry (which the export script pulls into the type graph).
// At runtime these are provided by Vite (frontend) or `scripts/raw-hook.mjs` (export).
declare module '*?raw' {
  const content: string;
  export default content;
}
