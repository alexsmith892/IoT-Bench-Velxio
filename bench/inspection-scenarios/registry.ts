import sketch from "../scenarios/uno-led-blink/sketch.ino?raw";
import { buildProject } from "../scenarios/uno-led-blink/circuit";
import { resolveLedPin } from "../contracts/ledPinResolver";

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
    taskMonitor: {
      kind: "led-blink",
      source: {
        boardId: "arduino-uno",
        componentId: "bench_led",
        pin: resolveLedPin(project, "bench_led"),
        label: "External red LED",
      },
      target: {
        frequencyHz: 1,
        dutyCycle: 0.5,
        tolerancePct: 5,
        minPeriods: 2,
      },
    },
  },
];
