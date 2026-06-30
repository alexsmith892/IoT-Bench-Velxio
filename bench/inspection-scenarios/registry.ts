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
];
