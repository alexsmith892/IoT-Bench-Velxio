/**
 * Pass 6 — compile-size observable (benchmark-design.md §7). Offline: no backend.
 * Covers (a) parsing flash/RAM out of the backend compile payload in
 * `compileClient`, and (b) the `maxFlashBytes`/`maxRamBytes` assertions against a
 * synthetic `trace.compile`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { compile } from '../compile/compileClient';
import { maxFlashBytes, maxRamBytes } from '../contracts/dsl';
import { buildProject } from '../scenarios/uno-led-blink/circuit';
import type { Trace } from '../harness/trace';
import type { AssertionContext } from '../contracts/types';

const ctx: AssertionContext = { circuit: buildProject('') };

function makeTrace(compileMeta?: Trace['compile']): Trace {
  return {
    pinEdges: [],
    serial: [],
    adcInputs: [],
    pwmSamples: [],
    serialInputs: [],
    durationMs: 1000,
    finalState: {},
    compile: compileMeta,
  };
}

afterEach(() => vi.unstubAllGlobals());

function stubCompile(body: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => body })),
  );
}

describe('compileClient size parsing', () => {
  it('parses flash + RAM from the arduino-cli stdout summary', async () => {
    stubCompile({
      success: true,
      hex_content: ':00000001FF\n',
      stdout:
        'Sketch uses 924 bytes (2%) of program storage space. Maximum is 32256 bytes.\n' +
        'Global variables use 9 bytes (0%) of dynamic memory, leaving 2039 bytes for local variables.\n',
      stderr: '',
    });
    const r = await compile([{ name: 'sketch.ino', content: '' }], 'arduino:avr:uno');
    expect(r.ok).toBe(true);
    expect(r.flashBytes).toBe(924);
    expect(r.ramBytes).toBe(9);
  });

  it('leaves sizes undefined when the summary is absent (e.g. compile failure)', async () => {
    stubCompile({ success: false, stdout: '', stderr: 'error: expected ;' });
    const r = await compile([{ name: 'sketch.ino', content: '' }], 'arduino:avr:uno');
    expect(r.ok).toBe(false);
    expect(r.flashBytes).toBeUndefined();
    expect(r.ramBytes).toBeUndefined();
  });
});

describe('maxFlashBytes / maxRamBytes assertions', () => {
  it('passes when within budget and tags compile-size', () => {
    const trace = makeTrace({ flashBytes: 924, ramBytes: 9 });
    const flash = maxFlashBytes(8192)(trace, ctx);
    expect(flash.pass).toBe(true);
    expect(flash.category).toBe('compile-size');
    expect(maxRamBytes(512)(trace, ctx).pass).toBe(true);
  });

  it('fails when over budget', () => {
    const trace = makeTrace({ flashBytes: 9000, ramBytes: 600 });
    expect(maxFlashBytes(8192)(trace, ctx).pass).toBe(false);
    expect(maxRamBytes(512)(trace, ctx).pass).toBe(false);
  });

  it('fails closed when the size is unavailable on the trace', () => {
    const trace = makeTrace(undefined);
    expect(maxFlashBytes(8192)(trace, ctx).pass).toBe(false);
    expect(maxRamBytes(512)(trace, ctx).pass).toBe(false);
  });
});
