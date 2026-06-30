/**
 * Layer 1 — compile client. Thin wrapper over the Velxio backend's
 * `POST /api/compile/` endpoint (see `backend/app/api/routes/compile.py` and
 * the request/response shapes in `frontend/src/services/compilation.ts`).
 * Keeping Velxio as the single compile backend matches the benchmark's
 * "use this service as the backend" goal (doc 03 §B, Layer 1).
 *
 * Requires the backend running (uvicorn + arduino-cli + cores) — a service,
 * not a Docker rebuild.
 */

export interface SketchFile {
  name: string;
  content: string;
}

export interface CompileResult {
  /** True only when the backend produced a hex image. */
  ok: boolean;
  /** Intel HEX text (present when `ok`). */
  hex: string | null;
  /** Combined compiler diagnostics — always populated on failure. */
  stderr: string;
  /**
   * Compiled program size (flash), in bytes — from arduino-cli's
   * "Sketch uses N bytes …" line. Undefined when the line is absent (e.g. a
   * compile failure). The cross-cutting memory check (benchmark-design.md §7).
   */
  flashBytes?: number;
  /**
   * Static RAM use (globals), in bytes — from arduino-cli's
   * "Global variables use N bytes …" line. Undefined when absent. NOTE: this is
   * the *compile-time* global figure; runtime heap/stack is NOT observable (§3).
   */
  ramBytes?: number;
  /** Raw backend payload, for debugging. */
  raw: unknown;
}

/**
 * Pull the first integer captured by `re` from `text`, or undefined. Used to
 * read arduino-cli's size summary out of stdout/stderr.
 */
function firstInt(text: string, re: RegExp): number | undefined {
  const m = re.exec(text);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

const DEFAULT_API = process.env.BENCH_API_BASE ?? 'http://127.0.0.1:8001';

/**
 * Compile a multi-file sketch for `boardFqbn` (e.g. `arduino:avr:uno`).
 * Never throws on a *compile* failure — returns `{ ok: false, stderr }` so the
 * runner can record a COMPILE_FAIL verdict (doc 03 step 1). Throws only on
 * transport/HTTP errors (backend unreachable).
 */
export async function compile(
  files: SketchFile[],
  boardFqbn: string,
  apiBase: string = DEFAULT_API,
): Promise<CompileResult> {
  const res = await fetch(`${apiBase}/api/compile/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, board_fqbn: boardFqbn }),
  });

  if (!res.ok) {
    throw new Error(`Compile endpoint ${apiBase} returned HTTP ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as {
    success?: boolean;
    hex_content?: string;
    stdout?: string;
    stderr?: string;
    error?: string;
  };

  const ok = !!body.success && typeof body.hex_content === 'string' && body.hex_content.length > 0;
  // arduino-cli prints the size summary to stdout; fall back to stderr just in
  // case a toolchain routes it differently.
  const sizeText = `${body.stdout ?? ''}\n${body.stderr ?? ''}`;
  return {
    ok,
    hex: ok ? body.hex_content! : null,
    stderr: [body.stderr, body.error].filter(Boolean).join('\n'),
    flashBytes: firstInt(sizeText, /Sketch uses (\d+) bytes/),
    ramBytes: firstInt(sizeText, /Global variables use (\d+) bytes/),
    raw: body,
  };
}
