import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { TaskMonitor } from '../components/simulator/TaskMonitor';
import { sampleHoldTracePath } from '../components/simulator/taskMonitorTrace';
import type { TaskMonitorDefinition } from '../lib/inspectionScenarios';
import { useTaskMonitorStore } from '../store/useTaskMonitorStore';

const definition: TaskMonitorDefinition = {
  boardId: 'arduino-uno',
  probes: [
    {
      channel: 'pinEdges',
      pin: 13,
      label: 'External LED',
      derive: ['level', 'digitalTiming', 'waveform'],
    },
    { channel: 'serial', label: 'Serial report', derive: ['log'] },
    { channel: 'pwm', pin: 3, label: 'LED duty', derive: ['value', 'trace'] },
    { channel: 'adc', pin: 1, label: 'Potentiometer', derive: ['value', 'trace'] },
  ],
};

afterEach(() => useTaskMonitorStore.getState().configure(null));

describe('declarative Task Monitor', () => {
  it('renders all generic widgets without a grading verdict', () => {
    useTaskMonitorStore.getState().configure(definition);
    const markup = renderToStaticMarkup(createElement(TaskMonitor, { definition }));
    expect(markup).toContain('Run the simulation to begin a fresh live capture.');
    for (const channel of ['pinEdges', 'serial', 'pwm', 'adc']) {
      expect(markup).toContain(`data-channel="${channel}"`);
    }
    expect(markup).toContain('RAF-paced and approximate');
    expect(markup).not.toMatch(/PASS|FAIL|IN TOLERANCE|OUT OF TOLERANCE/);
  });

  it('renders sparse values as a sample-and-hold line through the window end', () => {
    expect(sampleHoldTracePath([{ tMs: 100, value: 0.5 }], 5_000, 0, 1)).toBe(
      'M 20.00 40.00 L 1000 40.00',
    );
    expect(sampleHoldTracePath([{ tMs: 100, value: 0.5 }], 10_000, 0, 1)).toBe(
      'M 0.00 40.00 L 1000 40.00',
    );
  });
});
