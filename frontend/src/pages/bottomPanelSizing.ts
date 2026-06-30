export const BOTTOM_PANEL_MIN = 80;
export const BOTTOM_PANEL_MAX = 600;
export const BOTTOM_PANEL_DEFAULT = 200;
export const BOTTOM_PANEL_RESIZE_HANDLE_HEIGHT = 5;

export function clampBottomPanelHeight(requestedHeight: number, maximumHeight: number): number {
  const usableMaximum = Math.max(BOTTOM_PANEL_MIN, maximumHeight);
  return Math.max(BOTTOM_PANEL_MIN, Math.min(usableMaximum, requestedHeight));
}

export function taskMonitorMaximumHeight(simulatorPanelHeight: number): number {
  return Math.max(BOTTOM_PANEL_MIN, simulatorPanelHeight - BOTTOM_PANEL_RESIZE_HANDLE_HEIGHT);
}
