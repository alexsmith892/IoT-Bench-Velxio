import type { CircuitProject } from "../types";

export const BENCH_GROUP_ID = "group-arduino-uno";

export function buildProject(sketch: string): CircuitProject {
  return {
    format: "velxio-project",
    version: 1,
    exportedAt: "2026-06-30T00:00:00.000Z",
    name: "Uno Monitor Channels",
    boards: [
      {
        id: "arduino-uno",
        boardKind: "arduino-uno",
        x: 50,
        y: 50,
        activeFileGroupId: BENCH_GROUP_ID,
        languageMode: "arduino",
        serialBaudRate: 0,
        libraries: [],
      },
    ],
    fileGroups: { [BENCH_GROUP_ID]: [{ name: "sketch.ino", content: sketch }] },
    components: [
      {
        id: "monitor_pot",
        metadataId: "potentiometer",
        x: 390,
        y: 210,
        properties: { value: 640 },
      },
      {
        id: "monitor_led",
        metadataId: "led",
        x: 430,
        y: 90,
        properties: { color: "blue" },
      },
      {
        id: "monitor_resistor",
        metadataId: "resistor",
        x: 295,
        y: 120,
        properties: { value: "220" },
      },
    ],
    wires: [
      {
        id: "monitor_pwm",
        start: { componentId: "arduino-uno", pinName: "3", x: 0, y: 0 },
        end: { componentId: "monitor_resistor", pinName: "1", x: 0, y: 0 },
        waypoints: [],
        color: "#22c55e",
      },
      {
        id: "monitor_led_anode",
        start: { componentId: "monitor_resistor", pinName: "2", x: 0, y: 0 },
        end: { componentId: "monitor_led", pinName: "A", x: 0, y: 0 },
        waypoints: [],
        color: "#22c55e",
      },
      {
        id: "monitor_led_ground",
        start: { componentId: "monitor_led", pinName: "C", x: 0, y: 0 },
        end: { componentId: "arduino-uno", pinName: "GND.1", x: 0, y: 0 },
        waypoints: [],
        color: "#000000",
      },
      {
        id: "monitor_pot_signal",
        start: { componentId: "monitor_pot", pinName: "SIG", x: 0, y: 0 },
        end: { componentId: "arduino-uno", pinName: "A1", x: 0, y: 0 },
        waypoints: [],
        color: "#f59e0b",
      },
      {
        id: "monitor_pot_power",
        start: { componentId: "monitor_pot", pinName: "VCC", x: 0, y: 0 },
        end: { componentId: "arduino-uno", pinName: "5V", x: 0, y: 0 },
        waypoints: [],
        color: "#ef4444",
      },
      {
        id: "monitor_pot_ground",
        start: { componentId: "monitor_pot", pinName: "GND", x: 0, y: 0 },
        end: { componentId: "arduino-uno", pinName: "GND.2", x: 0, y: 0 },
        waypoints: [],
        color: "#000000",
      },
    ],
    activeBoardId: "arduino-uno",
  };
}
