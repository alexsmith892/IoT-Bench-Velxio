import { describe, expect, it } from "vitest";
import {
  analyzeDigitalTiming,
  type DigitalEdge,
} from "../../shared/digitalTiming";

const edges = (...values: Array<[number, 0 | 1]>): DigitalEdge[] =>
  values.map(([tMs, value]) => ({ tMs, value }));

describe("digital timing analysis", () => {
  it("measures the canonical 500ms HIGH/LOW blink", () => {
    const timing = analyzeDigitalTiming(
      edges([0, 1], [500, 0], [1000, 1], [1500, 0], [2000, 1]),
    );
    expect(timing).toMatchObject({
      edgeCount: 5,
      periods: [1000, 1000],
      duties: [0.5, 0.5],
      meanPeriodMs: 1000,
      freqHz: 1,
      dutyMean: 0.5,
      latestHighMs: 500,
      latestLowMs: 500,
    });
  });

  it("averages jitter and reports incomplete captures without invented measurements", () => {
    const timing = analyzeDigitalTiming(
      edges([10, 1], [490, 0], [990, 1], [1500, 0], [2020, 1]),
    );
    expect(timing.meanPeriodMs).toBe(1005);
    expect(timing.freqHz).toBeCloseTo(1000 / 1005);
    expect(timing.dutyMean).toBeCloseTo((480 / 980 + 510 / 1030) / 2);
    expect(analyzeDigitalTiming(edges([10, 1], [510, 0])).freqHz).toBeNull();
    expect(analyzeDigitalTiming([]).dutyMean).toBeNull();
  });

  it("tracks irregular phase durations without treating them as a verdict", () => {
    const timing = analyzeDigitalTiming(
      edges([0, 1], [250, 0], [1000, 1], [1400, 0]),
    );
    expect(timing.dutyMean).toBe(0.25);
    expect(timing.latestHighMs).toBe(400);
    expect(timing.latestLowMs).toBe(750);
  });
});
