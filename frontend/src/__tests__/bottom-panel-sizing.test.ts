import { describe, expect, it } from 'vitest';
import {
  BOTTOM_PANEL_MAX,
  BOTTOM_PANEL_MIN,
  clampBottomPanelHeight,
  taskMonitorMaximumHeight,
} from '../pages/bottomPanelSizing';

describe('bottom panel sizing', () => {
  it('lets the task monitor use the full simulator height instead of the old 600px ceiling', () => {
    const maximum = taskMonitorMaximumHeight(1_205);

    expect(maximum).toBe(1_200);
    expect(clampBottomPanelHeight(1_000, maximum)).toBe(1_000);
  });

  it('still clamps the task monitor to its physical container', () => {
    const maximum = taskMonitorMaximumHeight(900);

    expect(clampBottomPanelHeight(1_200, maximum)).toBe(895);
  });

  it('preserves the minimum and the standard-panel ceiling', () => {
    expect(clampBottomPanelHeight(0, BOTTOM_PANEL_MAX)).toBe(BOTTOM_PANEL_MIN);
    expect(clampBottomPanelHeight(1_000, BOTTOM_PANEL_MAX)).toBe(BOTTOM_PANEL_MAX);
  });
});
