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
import quadraturePosition from './quadrature-position/task';
import binaryFramedProtocol from './binary-framed-protocol/task';
import servoSlewPosition from './servo-slew-position/task';
import softwarePwmFade from './software-pwm-fade/task';
import cooperativeScheduler from './cooperative-scheduler/task';
import persistentEventCounter from './persistent-event-counter/task';
import zoneClimateController from './zone-climate-controller/task';
import waterTankController from './water-tank-controller/task';

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
  [quadraturePosition.id]: quadraturePosition,
  [binaryFramedProtocol.id]: binaryFramedProtocol,
  [servoSlewPosition.id]: servoSlewPosition,
  [softwarePwmFade.id]: softwarePwmFade,
  [cooperativeScheduler.id]: cooperativeScheduler,
  [persistentEventCounter.id]: persistentEventCounter,
  [zoneClimateController.id]: zoneClimateController,
  [waterTankController.id]: waterTankController,
};

export function getTask(id: string): OneShotScenario | undefined {
  return tasks[id];
}

export function taskIds(): string[] {
  return Object.keys(tasks);
}
