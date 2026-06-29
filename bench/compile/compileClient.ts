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
  /** Raw backend payload, for debugging. */
  raw: unknown;
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
  return {
    ok,
    hex: ok ? body.hex_content! : null,
    stderr: [body.stderr, body.error].filter(Boolean).join('\n'),
    raw: body,
  };
}
