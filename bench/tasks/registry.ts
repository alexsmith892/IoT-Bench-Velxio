import type { OneShotScenario } from './types';
import unoLedBlink from './uno-led-blink/task';
import activeLowInterlock from './active-low-interlock/task';
import dualInputSafetyEnable from './dual-input-safety-enable/task';
import tmp36CalibratedReport from './tmp36-calibrated-report/task';
import potentiometerPwmMap from './potentiometer-pwm-map/task';
import hexDipTo7Segment from './hex-dip-to-7segment/task';

/** All registered one-shot scenarios, keyed by id. */
export const tasks: Record<string, OneShotScenario> = {
  [unoLedBlink.id]: unoLedBlink,
  [activeLowInterlock.id]: activeLowInterlock,
  [dualInputSafetyEnable.id]: dualInputSafetyEnable,
  [tmp36CalibratedReport.id]: tmp36CalibratedReport,
  [potentiometerPwmMap.id]: potentiometerPwmMap,
  [hexDipTo7Segment.id]: hexDipTo7Segment,
};

export function getTask(id: string): OneShotScenario | undefined {
  return tasks[id];
}

export function taskIds(): string[] {
  return Object.keys(tasks);
}
