import type { CircuitProject } from '../scenarios/types';
import type { SketchFile } from '../compile/compileClient';
import type { Contract } from '../contracts/types';

/**
 * A benchmark task (L1 PoC shape). One task = one scored item. The 3-mode
 * (one-shot / fix / extend) expansion and per-mode firmware slots come later
 * (benchmark-notes doc 04) — this is the one-shot vertical slice.
 */
export interface BenchTask {
  id: string;
  /** Compile target, e.g. `arduino:avr:uno`. */
  board: string;
  /** The circuit — single source of truth, shared with the inspection page. */
  circuit: CircuitProject;
  /** The reference (correct) firmware used to gate the task. */
  referenceFirmware: SketchFile[];
  /** How long to simulate, in milliseconds. */
  runMs: number;
  /** Behavioural assertions, all of which must pass. */
  contract: Contract;
}
