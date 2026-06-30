import sketch from "../scenarios/uno-led-blink/sketch.ino?raw";
import { buildProject } from "../scenarios/uno-led-blink/circuit";
import monitorSketch from "../scenarios/uno-monitor-channels/sketch.ino?raw";
import { buildProject as buildMonitorProject } from "../scenarios/uno-monitor-channels/circuit";

// The circuit wiring is shared with the headless grading harness via
// `bench/scenarios/<id>/circuit.ts` (single source of truth); only the
// firmware-loading mechanism differs (Vite `?raw` here, Node `fs` in the
// grader). See `bench/scenarios/types.ts`.
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
        {
          channel: "pwm",
          pin: 3,
          label: "Mapped LED duty",
          derive: ["value", "trace"],
        },
        {
          channel: "adc",
          pin: 1,
          label: "Potentiometer A1",
          derive: ["value", "trace"],
        },
        {
          channel: "serial",
          label: "ADC/PWM report",
          derive: ["log"],
        },
      ],
    },
  },
];
