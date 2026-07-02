/** Minimal AVR instruction assembler for bench EEPROM offline tests. */
export const LDI = (rd: number, k: number): number => {
  const d = rd - 16;
  return 0xe000 | ((k & 0xf0) << 4) | (d << 4) | (k & 0x0f);
};

/** STS k, Rr — store register Rr to data address k. */
export const STS = (k: number, rr: number): [number, number] => {
  const w1 = 0x9200 | ((rr & 0x10) << 4) | ((rr & 0x0f) << 4);
  return [w1, k & 0xffff];
};

/** LDS Rd, k — load from data address k into Rd. */
export const LDS = (rd: number, k: number): [number, number] => {
  const w1 = 0x9000 | ((rd & 0x10) << 4) | ((rd & 0x0f) << 4);
  return [w1, k & 0xffff];
};

export const RJMP = (offset: number): number => 0xc000 | (offset & 0xfff);
export const SBRC = (rr: number, b: number): number => 0xfc00 | (rr << 4) | (b & 0x07);

export function assemble(items: Array<number | number[]>): Uint16Array {
  const flat: number[] = [];
  for (const it of items) {
    if (Array.isArray(it)) flat.push(...it);
    else flat.push(it);
  }
  return Uint16Array.from(flat);
}

const EECR = 0x3f;
const EEDR = 0x40;
const EEARL = 0x41;
const EEARH = 0x42;
const EEMPE = 0x04;
const EEPE = 0x02;
const EERE = 0x01;

const setEepromAddr = (addr: number) => [
  LDI(16, addr & 0xff),
  STS(EEARL, 16),
  LDI(16, (addr >> 8) & 0xff),
  STS(EEARH, 16),
];

/** Write `value` to EEPROM `addr`, poll EEPE, read back into r20. */
export function eepromWritePollReadProgram(addr: number, value: number): Uint16Array {
  return assemble([
    ...setEepromAddr(addr),
    LDI(16, value),
    STS(EEDR, 16),
    LDI(16, EEMPE),
    STS(EECR, 16),
    LDI(16, EEPE),
    STS(EECR, 16),
    LDS(17, EECR),
    SBRC(17, 1),
    RJMP(-4),
    ...setEepromAddr(addr),
    LDI(16, EERE),
    STS(EECR, 16),
    LDS(20, EEDR),
    RJMP(-1),
  ]);
}
