import sketch from "../scenarios/uno-led-blink/sketch.ino?raw";
import { buildProject } from "../scenarios/uno-led-blink/circuit";
import monitorSketch from "../scenarios/uno-monitor-channels/sketch.ino?raw";
import { buildProject as buildMonitorProject } from "../scenarios/uno-monitor-channels/circuit";
import interlockSketch from "../scenarios/active-low-interlock/sketch.ino?raw";
import { buildProject as buildInterlockProject } from "../scenarios/active-low-interlock/circuit";
import dualInputSketch from "../scenarios/dual-input-safety-enable/sketch.ino?raw";
import { buildProject as buildDualInputProject } from "../scenarios/dual-input-safety-enable/circuit";
import tmp36Sketch from "../scenarios/tmp36-calibrated-report/sketch.ino?raw";
import { buildProject as buildTmp36Project } from "../scenarios/tmp36-calibrated-report/circuit";
import potPwmSketch from "../scenarios/potentiometer-pwm-map/sketch.ino?raw";
import { buildProject as buildPotPwmProject } from "../scenarios/potentiometer-pwm-map/circuit";
import hexSegSketch from "../scenarios/hex-dip-to-7segment/sketch.ino?raw";
import { buildProject as buildHexSegProject } from "../scenarios/hex-dip-to-7segment/circuit";
import debouncedToggleSketch from "../scenarios/debounced-toggle/sketch.ino?raw";
import { buildProject as buildDebouncedToggleProject } from "../scenarios/debounced-toggle/circuit";
import lightAlarmSketch from "../scenarios/light-alarm-hysteresis/sketch.ino?raw";
import { buildProject as buildLightAlarmProject } from "../scenarios/light-alarm-hysteresis/circuit";
import dualSchedulerSketch from "../scenarios/responsive-dual-scheduler/sketch.ino?raw";
import { buildProject as buildDualSchedulerProject } from "../scenarios/responsive-dual-scheduler/circuit";
import rollingAvgSketch from "../scenarios/rolling-adc-average/sketch.ino?raw";
import { buildProject as buildRollingAvgProject } from "../scenarios/rolling-adc-average/circuit";
import overflowAccSketch from "../scenarios/integer-overflow-accumulator/sketch.ino?raw";
import { buildProject as buildOverflowAccProject } from "../scenarios/integer-overflow-accumulator/circuit";
import serialCtrlSketch from "../scenarios/serial-control-protocol/sketch.ino?raw";
import { buildProject as buildSerialCtrlProject } from "../scenarios/serial-control-protocol/circuit";
import fourModeSketch from "../scenarios/four-mode-indicator/sketch.ino?raw";
import { buildProject as buildFourModeProject } from "../scenarios/four-mode-indicator/circuit";
import reactionSketch from "../scenarios/reaction-timer-fsm/sketch.ino?raw";
import { buildProject as buildReactionProject } from "../scenarios/reaction-timer-fsm/circuit";
import applianceSketch from "../scenarios/appliance-cycle-fsm/sketch.ino?raw";
import { buildProject as buildApplianceProject } from "../scenarios/appliance-cycle-fsm/circuit";

// The circuit wiring is shared with the headless grading harness via
// `bench/scenarios/<id>/circuit.ts` (single source of truth); only the
// firmware-loading mechanism differs (Vite `?raw` here, Node `fs` in the
// grader). See `bench/scenarios/types.ts`.
//
// The Pass-6 D1 tasks below rely on the zero-config default probes for plain
// GPIO tasks (every connected MCU pin auto-derives) and add explicit probes only
// for the analog/serial channels (ADC/PWM/serial) that benefit from task labels.
const project = buildProject(sketch);

export const inspectionScenarios = [
  {
    id: "uno-led-blink",
    title: "Arduino Uno LED Blink",
    project,
  },
  {
    id: "uno-monitor-channels",
    title: "Arduino Uno PWM, ADC, and Serial Monitor",
    project: buildMonitorProject(monitorSketch),
    taskMonitor: {
      boardId: "arduino-uno",
      probes: [
        { channel: "pwm", pin: 3, label: "Mapped LED duty", derive: ["value", "trace"] },
        { channel: "adc", pin: 1, label: "Potentiometer A1", derive: ["value", "trace"] },
        { channel: "serial", label: "ADC/PWM report", derive: ["log"] },
      ],
    },
  },
  {
    id: "active-low-interlock",
    title: "D1 · Active-Low Interlock",
    project: buildInterlockProject(interlockSketch),
  },
  {
    id: "dual-input-safety-enable",
    title: "D1 · Dual-Input Safety Enable",
    project: buildDualInputProject(dualInputSketch),
  },
  {
    id: "tmp36-calibrated-report",
    title: "D1 · TMP36 Calibrated Report",
    project: buildTmp36Project(tmp36Sketch),
    taskMonitor: {
      boardId: "arduino-uno",
      probes: [
        { channel: "adc", pin: 0, label: "TMP36 A0", derive: ["value", "trace"] },
        { channel: "serial", label: "TEMP_C report", derive: ["log"] },
      ],
    },
  },
  {
    id: "potentiometer-pwm-map",
    title: "D1 · Potentiometer PWM Map",
    project: buildPotPwmProject(potPwmSketch),
    taskMonitor: {
      boardId: "arduino-uno",
      probes: [
        { channel: "adc", pin: 1, label: "Potentiometer A1", derive: ["value", "trace"] },
        { channel: "pwm", pin: 3, label: "LED duty (D3)", derive: ["value", "trace"] },
      ],
    },
  },
  {
    id: "hex-dip-to-7segment",
    title: "D1 · Hex DIP to 7-Segment",
    project: buildHexSegProject(hexSegSketch),
  },
  {
    id: "debounced-toggle",
    title: "D2 · Debounced Toggle",
    project: buildDebouncedToggleProject(debouncedToggleSketch),
    // Zero-config: default probes derive the button D2 and the active-low LED D7.
  },
  {
    id: "light-alarm-hysteresis",
    title: "D2 · Light Alarm Hysteresis",
    project: buildLightAlarmProject(lightAlarmSketch),
    taskMonitor: {
      boardId: "arduino-uno",
      probes: [
        { channel: "adc", pin: 2, label: "Light sensor A2", derive: ["value", "trace"] },
        { channel: "pinEdges", pin: 6, label: "Warning LED (D6)", derive: ["level", "digitalTiming"] },
      ],
    },
  },
  {
    id: "responsive-dual-scheduler",
    title: "D2 · Responsive Dual Scheduler",
    project: buildDualSchedulerProject(dualSchedulerSketch),
    taskMonitor: {
      boardId: "arduino-uno",
      probes: [
        { channel: "pinEdges", pin: 3, label: "LED A 1 Hz (D3)", derive: ["level", "digitalTiming", "waveform"] },
        { channel: "pinEdges", pin: 5, label: "LED B 2 Hz (D5)", derive: ["level", "digitalTiming", "waveform"] },
        // Button (D2) and response LED (D8) are aperiodic (button-driven): show the
        // level and a scope so the high/low tracking is visible, but NOT
        // digitalTiming — frequency/period/duty are meaningless for a button mirror.
        { channel: "pinEdges", pin: 2, label: "Button (D2)", derive: ["level", "waveform"] },
        { channel: "pinEdges", pin: 8, label: "Response LED (D8)", derive: ["level", "waveform"] },
      ],
    },
  },
  {
    id: "rolling-adc-average",
    title: "D2 · Rolling ADC Average",
    project: buildRollingAvgProject(rollingAvgSketch),
    taskMonitor: {
      boardId: "arduino-uno",
      probes: [
        { channel: "adc", pin: 0, label: "Signal A0", derive: ["value", "trace"] },
        { channel: "serial", label: "AVG report", derive: ["log"] },
      ],
    },
  },
  {
    id: "integer-overflow-accumulator",
    title: "D2 · Integer Overflow Accumulator",
    project: buildOverflowAccProject(overflowAccSketch),
    taskMonitor: {
      boardId: "arduino-uno",
      probes: [{ channel: "serial", label: "Stats I/O", derive: ["log"] }],
    },
  },
  {
    id: "serial-control-protocol",
    title: "D2 · Serial Control Protocol",
    project: buildSerialCtrlProject(serialCtrlSketch),
    taskMonitor: {
      boardId: "arduino-uno",
      probes: [
        { channel: "pinEdges", pin: 7, label: "LED (D7)", derive: ["level"] },
        { channel: "pwm", pin: 3, label: "PWM (D3)", derive: ["value", "trace"] },
        { channel: "serial", label: "Command I/O", derive: ["log"] },
      ],
    },
  },
  {
    id: "four-mode-indicator",
    title: "D3 · Four-Mode Indicator",
    project: buildFourModeProject(fourModeSketch),
    taskMonitor: {
      boardId: "arduino-uno",
      probes: [
        { channel: "pinEdges", pin: 4, label: "Indicator LED (D4)", derive: ["level", "digitalTiming", "waveform"] },
        { channel: "pinEdges", pin: 3, label: "Buzzer (D3)", derive: ["level", "waveform"] },
        { channel: "pinEdges", pin: 2, label: "Mode button (D2)", derive: ["level"] },
      ],
    },
  },
  {
    id: "reaction-timer-fsm",
    title: "D3 · Reaction Timer FSM",
    project: buildReactionProject(reactionSketch),
    taskMonitor: {
      boardId: "arduino-uno",
      probes: [
        { channel: "pinEdges", pin: 8, label: "Cue LED (D8)", derive: ["level", "waveform"] },
        { channel: "pinEdges", pin: 2, label: "START (D2)", derive: ["level"] },
        { channel: "pinEdges", pin: 3, label: "STOP (D3)", derive: ["level"] },
        { channel: "serial", label: "Timer output", derive: ["log"] },
      ],
    },
  },
  {
    id: "appliance-cycle-fsm",
    title: "D3 · Appliance Cycle FSM",
    project: buildApplianceProject(applianceSketch),
    taskMonitor: {
      boardId: "arduino-uno",
      probes: [
        { channel: "pinEdges", pin: 6, label: "FILL (D6)", derive: ["level", "waveform"] },
        { channel: "pinEdges", pin: 7, label: "MOTOR (D7)", derive: ["level", "waveform"] },
        { channel: "pinEdges", pin: 8, label: "DRAIN (D8)", derive: ["level", "waveform"] },
        { channel: "pinEdges", pin: 2, label: "Door (D2)", derive: ["level"] },
        { channel: "pinEdges", pin: 3, label: "Button (D3)", derive: ["level"] },
        { channel: "serial", label: "STATE output", derive: ["log"] },
      ],
    },
  },
];
