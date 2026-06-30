/**
 * Pinned execution environment (benchmark-notes one-shot-implementation-plan
 * Pass 1; benchmark-design.md §5: "Environment pinned: avr8js, Arduino core,
 * and library versions fixed and recorded"). A graded result is only reproducible
 * against a known toolchain, so the harness records exactly what produced it.
 *
 * Two tiers, captured separately because they live in different processes:
 *   - HARNESS (this Node package): avr8js + the TS/runner toolchain.
 *   - COMPILE BACKEND (arduino-cli, separate process/Docker): the AVR core.
 *
 * Human note + re-capture procedure: bench/env-lock.md.
 */
export const PINNED_ENV = {
  // --- Harness (simulation) ---
  /** avr8js — the AVR core simulator. Pinned exactly in package.json/lock. */
  avr8js: '0.21.0',
  /** Node runtime the harness was validated on. */
  node: 'v22.22.3',
  typescript: '~5.9.3',
  tsx: '^4.19.2',
  vitest: '^4.0.18',

  // --- Compile backend (arduino-cli, separate process) ---
  /** arduino-cli version on the compile backend. */
  arduinoCli: '1.5.1',
  /** arduino:avr board package (AVR core + avr-gcc toolchain). */
  arduinoCore: 'arduino:avr@1.8.8',

  /** When these were captured (re-verify with env-lock.md before a scored run). */
  capturedAt: '2026-06-29',
} as const;

/** One-line banner so every CLI run records the environment it ran on. */
export function envBanner(): string {
  return `env: avr8js ${PINNED_ENV.avr8js} · ${PINNED_ENV.arduinoCore} · arduino-cli ${PINNED_ENV.arduinoCli} · node ${PINNED_ENV.node}`;
}
