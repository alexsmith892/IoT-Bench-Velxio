import type { OneShotScenario } from './types';
import unoLedBlink from './uno-led-blink/task';
import activeLowInterlock from './active-low-interlock/task';
import dualInputSafetyEnable from './dual-input-safety-enable/task';
import tmp36CalibratedReport from './tmp36-calibrated-report/task';
import potentiometerPwmMap from './potentiometer-pwm-map/task';
import hexDipTo7Segment from './hex-dip-to-7segment/task';
import debouncedToggle from './debounced-toggle/task';
import lightAlarmHysteresis from './light-alarm-hysteresis/task';
import responsiveDualScheduler from './responsive-dual-scheduler/task';
import rollingAdcAverage from './rolling-adc-average/task';
import integerOverflowAccumulator from './integer-overflow-accumulator/task';
import serialControlProtocol from './serial-control-protocol/task';
import fourModeIndicator from './four-mode-indicator/task';
import reactionTimerFsm from './reaction-timer-fsm/task';
import applianceCycleFsm from './appliance-cycle-fsm/task';

/** All registered one-shot scenarios, keyed by id. */
export const tasks: Record<string, OneShotScenario> = {
  [unoLedBlink.id]: unoLedBlink,
  [activeLowInterlock.id]: activeLowInterlock,
  [dualInputSafetyEnable.id]: dualInputSafetyEnable,
  [tmp36CalibratedReport.id]: tmp36CalibratedReport,
  [potentiometerPwmMap.id]: potentiometerPwmMap,
  [hexDipTo7Segment.id]: hexDipTo7Segment,
  [debouncedToggle.id]: debouncedToggle,
  [lightAlarmHysteresis.id]: lightAlarmHysteresis,
  [responsiveDualScheduler.id]: responsiveDualScheduler,
  [rollingAdcAverage.id]: rollingAdcAverage,
  [integerOverflowAccumulator.id]: integerOverflowAccumulator,
  [serialControlProtocol.id]: serialControlProtocol,
  [fourModeIndicator.id]: fourModeIndicator,
  [reactionTimerFsm.id]: reactionTimerFsm,
  [applianceCycleFsm.id]: applianceCycleFsm,
};

export function getTask(id: string): OneShotScenario | undefined {
  return tasks[id];
}

export function taskIds(): string[] {
  return Object.keys(tasks);
}
