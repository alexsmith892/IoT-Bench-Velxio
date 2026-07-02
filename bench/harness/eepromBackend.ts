/**
 * EEPROM backend wrapper — records firmware-initiated writes for grading (Pass 10).
 * Stimulus `eepromSeed` writes the inner backend directly and is NOT counted.
 */
import { EEPROMMemoryBackend, type EEPROMBackend } from 'avr8js';

const UNO_EEPROM_SIZE = 1024;

export type EepromWriteCallback = (addr: number, value: number) => void;

export class CountingEepromBackend implements EEPROMBackend {
  readonly inner: EEPROMMemoryBackend;

  constructor(onWrite: EepromWriteCallback) {
    this.inner = new EEPROMMemoryBackend(UNO_EEPROM_SIZE);
    this.onWrite = onWrite;
  }

  private onWrite: EepromWriteCallback;

  readMemory(addr: number): number {
    return this.inner.readMemory(addr);
  }

  writeMemory(addr: number, value: number): void {
    this.onWrite(addr, value);
    this.inner.writeMemory(addr, value);
  }

  eraseMemory(addr: number): void {
    this.onWrite(addr, 0xff);
    this.inner.eraseMemory(addr);
  }

  /** Stimulus pre-seed — does not increment the firmware write-count observable. */
  seedByte(addr: number, value: number): void {
    this.inner.memory[addr] = value;
  }

  snapshot(): Uint8Array {
    return new Uint8Array(this.inner.memory);
  }
}
