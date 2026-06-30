import type { CircuitProject } from '../scenarios/types';
import type { SketchFile } from '../compile/compileClient';
import type { Contract, AssertionCategory } from '../contracts/types';
import type { StimulusEvent } from '../harness/stimulus';

/**
 * Runtime shape the harness/runner/gate consume — everything needed to compile,
 * simulate, and grade one attempt. Deliberately minimal and STABLE: keeping it
 * unchanged is what lets the existing runner, artifact writer, and tests work
 * untouched while `OneShotScenario` (below) layers the public metadata on top.
 * (`OneShotScenario extends BenchTask`, so the runner accepts either.)
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

/** Scored difficulty bucket (provisional; recalibrated from pilot pass-rates). */
export type Difficulty = 'D1' | 'D2' | 'D3' | 'D4';

/** Harness-capability cost tier — the build-order gate, NOT the difficulty. */
export type HarnessTier = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/**
 * A hidden stimulus/contract variant over the same firmware. Pass 2 added the
 * `stimulus` injection timeline (in ms); Pass 4 added the per-variant `contract`
 * override and `budgetMs`. A task with no authored variants is run as a single
 * implicit base variant (base contract, no stimulus, `runMs` budget).
 */
export interface OneShotVariant {
  id: string;
  description?: string;
  /** Timed input stimulus applied over this variant's run (see harness/stimulus.ts). */
  stimulus?: StimulusEvent[];
  /** Overrides the task's base `contract` for this variant (defaults to it). */
  contract?: Contract;
  /** Sim-time budget for this variant in ms (defaults to the task's `runMs`). */
  budgetMs?: number;
}

/**
 * An adversarial-wrong solution authored to be REJECTED by the gate (Pass 4,
 * benchmark-design.md §5.2). Each declares the assertion category it MUST fail
 * on, so the gate confirms it fails for the *intended* reason — not incidentally.
 *
 * NOTE (divergence from Pass 1): the schema originally typed `adversarialWrongs`
 * as `string[]` (paths). Pass 4 needs the intended-failure-category per wrong, so
 * it is now `AdversarialWrong[]`. See reflections/pass-04.md §1.
 */
export interface AdversarialWrong {
  id: string;
  /** Sketch file paths, relative to the scenario directory (like referenceSolution). */
  files: string[];
  /** The assertion category this wrong is designed to fail (the gate enforces it). */
  expectFailCategory: AssertionCategory;
  description?: string;
}

/**
 * The frozen authoring manifest for a one-shot task: the public, LLM-facing
 * prompt plus the reporting metadata. It EXTENDS `BenchTask`, so the existing
 * runner/gate run it unchanged.
 *
 * Design intent (Pass 1): this shape must carry serial/PWM/ADC/device tasks
 * without a breaking change. Observable channels live in the Trace
 * (`harness/trace.ts`), not here; stimulus and per-variant contracts attach to
 * `variants` in later passes. See one-shot-implementation-plan.md.
 */
export interface OneShotScenario extends BenchTask {
  /** Scored difficulty bucket (provisional). */
  difficulty: Difficulty;
  /**
   * Unscored coverage tag for reporting (e.g. "GPIO/circuit", "analog/numeric",
   * "bus-device(I2C)"). Free-form on purpose — see benchmark-design.md §6a for
   * the canonical set; not typed as a union, so compound tags don't force churn.
   */
  domain: string;
  /** Harness-cost tier(s); compound tasks list several (e.g. ['A', 'D']). */
  tiers: HarnessTier[];
  /** Arduino libraries to install before compiling (e.g. [] or ['Wire']). */
  libraries: string[];
  /** The complete public prompt shown to the model. */
  prompt: string;
  /**
   * Reference-solution file paths, relative to the scenario directory — the
   * CANONICAL record of the reference. `referenceFirmware` (from BenchTask) is
   * the resolved content the harness runs, read from these paths via
   * `scenarios/firmware.ts#readSketchFiles` so the two cannot drift.
   */
  referenceSolution: string[];
  /** Adversarial-wrong solutions, each with its intended-failure category (Pass 4). */
  adversarialWrongs: AdversarialWrong[];
  /** Hidden stimulus/contract variants (Pass 4). Empty → one implicit base variant. */
  variants: OneShotVariant[];
  /**
   * Resolve sketch file paths (relative to the scenario dir) to runnable
   * `SketchFile[]`. Set by the task module (it owns the dir URL) so the gate can
   * read `adversarialWrongs[].files` generically without knowing the layout.
   */
  resolveFirmware?: (relPaths: string[]) => SketchFile[];
}
