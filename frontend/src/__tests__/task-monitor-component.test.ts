import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { TaskMonitor } from '../components/simulator/TaskMonitor';
import type { TaskMonitorDefinition } from '../lib/inspectionScenarios';
import { useTaskMonitorStore } from '../store/useTaskMonitorStore';

const definition: TaskMonitorDefinition = {
  kind: 'led-blink',
  source: {
    boardId: 'arduino-uno',
    componentId: 'bench_led',
    pin: 13,
    label: 'External red LED',
  },
  target: { frequencyHz: 1, dutyCycle: 0.5, tolerancePct: 5, minPeriods: 2 },
};

const renderMonitor = () => renderToStaticMarkup(createElement(TaskMonitor, { definition }));

afterEach(() => useTaskMonitorStore.getState().configure(null));

describe('LED Task Monitor', () => {
  it('renders its idle guidance and target without a grading verdict', () => {
    useTaskMonitorStore.getState().configure(definition);
    const markup = renderMonitor();
    expect(markup).toContain('Run the simulation to begin a fresh live capture.');
    expect(markup).toContain('1 Hz / 50%');
    expect(markup).not.toMatch(/PASS|FAIL|IN TOLERANCE|OUT OF TOLERANCE/);
  });
});
