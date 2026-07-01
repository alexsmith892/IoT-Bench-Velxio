/**
 * The SINGLE source of grading tolerances and assertion weights (Pass 3,
 * benchmark-design.md §6b/§6c). No assertion builder hides a magic number — they
 * all default from here, so calibrating the benchmark is a one-file edit and the
 * reflection can audit every tolerance in one place.
 *
 * Tolerance philosophy (benchmark-design.md §3, §8): avr8js is instruction-
 * accurate, not pipeline-cycle-exact, so the only timing error on a correct
 * solution is `delay()`/loop overhead. Tolerances are "safe but not generous" —
 * wide enough to pass a correct reference, tight enough to fail a wrong one.
 * Each carries a principled/guess note for the reflection.
 */

export const TOLERANCES = {
  /** Frequency match, percent. Principled: cycle-accurate clock → only loop drift. */
  freqPct: 5,
  /** Duty-cycle match, percent (of the target duty). Principled, same basis. */
  dutyPct: 5,
  /** Hardware-PWM duty match, percent. Wider: OCR is 8-bit → ±1 LSB ≈ ±0.4%. */
  pwmDutyPct: 5,
  /**
   * Default relative tolerance for a decoded numeric value, percent. Guess —
   * needs per-task calibration (a temperature in °C and a count have different
   * natural tolerances); most numeric assertions should pass an explicit one.
   */
  numericPct: 2,
  /**
   * Default timing window, ms, for "event happened around time t" checks.
   * Principled floor: benchmark-design.md §4 mandates all timing windows ≥ a few ms.
   */
  timingWindowMs: 20,
  /**
   * Servo/pulse HIGH-width match, microseconds (Pass 9 `pulseWidth`). Principled:
   * the 1000–2000µs servo band spans 180°, so 40µs ≈ ±3.6° — comfortably wider
   * than the sub-µs edge-timestamp resolution yet tight enough to fail a mis-mapped
   * or instant-jump wrong (which miss by hundreds of µs).
   */
  pulseWidthUs: 40,
  /**
   * Servo angle match, degrees (Pass 9 `servoAngle`). Set at 6° (~33µs) — wider
   * than the ~14µs jitter of the reference so that ALTERNATIVE valid pulse
   * generators (Timer1 CTC / delayMicroseconds / micros-polling, each with a
   * different constant edge offset) still pass, while a wrong mapping (off by
   * hundreds of µs) fails. Settled-angle checks do no discrimination work here
   * (instant-jump fails on the mid-slew window, blocking on frequency), so the
   * wider band costs no wrong-detection. Principled (FN-protection).
   */
  servoAngleDeg: 6,
} as const;

export const WEIGHTS = {
  /**
   * Semantic (value) assertion weight in the value/format split (§6c). ≥ format,
   * so a correct-logic / wrong-format answer keeps the majority of the task and a
   * right-format / wrong-logic answer cannot pass.
   */
  semantic: 0.7,
  /** Format (literal shape) assertion weight in the split. ≤ semantic. */
  format: 0.3,
  /** Default weight for an unsplit assertion. */
  default: 1,
} as const;
