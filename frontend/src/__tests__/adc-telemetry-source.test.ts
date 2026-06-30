import { describe, expect, it, vi } from 'vitest';
import { PinManager } from '../simulation/PinManager';
import type { AnySimulator } from '../simulation/parts/PartSimulationRegistry';
import { setAdcVoltage } from '../simulation/parts/partUtils';

describe('ADC telemetry source', () => {
  it('updates the real AVR ADC and the shared PinManager observation path', () => {
    const pinManager = new PinManager();
    const observer = vi.fn();
    pinManager.onAnyAnalogChange(observer);
    const adc = { channelValues: Array<number>(8).fill(0) };
    const simulator = {
      pinManager,
      getADC: () => adc,
    } as unknown as AnySimulator;

    expect(setAdcVoltage(simulator, 15, 2.5)).toBe(true);
    expect(adc.channelValues[1]).toBe(2.5);
    expect(observer).toHaveBeenCalledWith(15, 2.5);
    expect([...pinManager.getAnalogValues()]).toEqual([[15, 2.5]]);
  });
});
