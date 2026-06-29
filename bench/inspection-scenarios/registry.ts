import sketch from "./uno-led-blink/sketch.ino?raw";

export const inspectionScenarios = [
  {
    id: "uno-led-blink",
    title: "Arduino Uno LED Blink",
    project: {
      format: "velxio-project",
      version: 1,
      exportedAt: "2026-06-29T00:00:00.000Z",
      name: "Uno LED Blink",
      boards: [
        {
          id: "arduino-uno",
          boardKind: "arduino-uno",
          x: 50,
          y: 50,
          activeFileGroupId: "group-arduino-uno",
          languageMode: "arduino",
          serialBaudRate: 0,
          libraries: [],
        },
      ],
      fileGroups: {
        "group-arduino-uno": [{ name: "sketch.ino", content: sketch }],
      },
      components: [
        {
          id: "bench_led",
          metadataId: "led",
          x: 430,
          y: 110,
          properties: { color: "red" },
        },
        {
          id: "bench_resistor",
          metadataId: "resistor",
          x: 290,
          y: 140,
          properties: { value: "220" },
        },
      ],
      wires: [
        {
          id: "bench_wire_pin13",
          start: { componentId: "arduino-uno", pinName: "13", x: 0, y: 0 },
          end: { componentId: "bench_resistor", pinName: "1", x: 0, y: 0 },
          waypoints: [],
          color: "#22c55e",
        },
        {
          id: "bench_wire_anode",
          start: { componentId: "bench_resistor", pinName: "2", x: 0, y: 0 },
          end: { componentId: "bench_led", pinName: "A", x: 0, y: 0 },
          waypoints: [],
          color: "#22c55e",
        },
        {
          id: "bench_wire_cathode",
          start: { componentId: "bench_led", pinName: "C", x: 0, y: 0 },
          end: { componentId: "arduino-uno", pinName: "GND.1", x: 0, y: 0 },
          waypoints: [],
          color: "#000000",
        },
      ],
      activeBoardId: "arduino-uno",
    },
  },
];
