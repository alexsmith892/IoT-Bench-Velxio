/**
 * AVRHarness — typed avr8js wrapper for the ATmega328P (Arduino Uno/Nano) and
 * pin-compatible AVRs. A faithful TS port of
 * `test/test_circuit/src/avr/AVRHarness.js`, mirroring how Velxio's
 * `frontend/src/simulation/AVRSimulator.ts` drives the CPU, with one addition:
 * port transitions are timestamped into a `TraceRecorder` so grading happens
 * offline against a serialisable `Trace` (benchmark-notes doc 03 §B).
 */
import {
  CPU,
  AVRIOPort,
  AVRTimer,
  AVRADC,
  AVRUSART,
  AVREEPROM,
  eepromConfig,
  portBConfig,
  portCConfig,
  portDConfig,
  timer0Config,
  timer1Config,
  timer2Config,
  adcConfig,
  usart0Config,
  avrInstruction,
} from 'avr8js';
import { parseIntelHex, bytesToProgramWords } from './intelHex';
import { TraceRecorder, type Trace } from './trace';
import { CountingEepromBackend } from './eepromBackend';
import type { SimHarness } from './SimHarness';

const CLOCK_HZ = 16_000_000;

type PortName = 'B' | 'C' | 'D';

// Arduino Uno pin ↔ (port, bit):
//   PORTD bit 0..7 → D0..D7
//   PORTB bit 0..5 → D8..D13
//   PORTC bit 0..5 → A0..A5 (pins 14..19)
const PIN_MAP: Record<number, { portName: PortName; bit: number }> = {};
for (let i = 0; i < 8; i++) PIN_MAP[i] = { portName: 'D', bit: i };
for (let i = 0; i < 6; i++) PIN_MAP[8 + i] = { portName: 'B', bit: i };
for (let i = 0; i < 6; i++) PIN_MAP[14 + i] = { portName: 'C', bit: i };

function portBitToArduinoPin(portName: PortName, bit: number): number | null {
  if (portName === 'B' && bit < 6) return 8 + bit;
  if (portName === 'C' && bit < 6) return 14 + bit;
  if (portName === 'D' && bit < 8) return bit;
  return null;
}

// ATmega328P I/O register addresses (data-space) for each port. We read DDR to
// tell a *driven output* from an INPUT_PULLUP — mirroring how the product
// simulator gates pin updates on DDR (frontend/src/simulation/AVRSimulator.ts).
// Without this, writing 1 to PORT on an input pin (enabling the pullup) would
// be mis-recorded as the pin driving an LED HIGH — the canonical INPUT_PULLUP
// false positive that visual-led-test.mjs exists to catch.
const PORT_REGS: Record<PortName, { port: number; ddr: number }> = {
  B: { port: 0x25, ddr: 0x24 },
  C: { port: 0x28, ddr: 0x27 },
  D: { port: 0x2b, ddr: 0x2a },
};

// ── Hardware-PWM units (analogWrite via OCR) ─────────────────────────────────
interface PwmUnit {
  pin: number;
  tccrA: number;
  ocr: number;
  comShift: 6 | 4;
}
const PWM_UNITS: PwmUnit[] = [
  { pin: 6, tccrA: 0x44, ocr: 0x47, comShift: 6 },
  { pin: 5, tccrA: 0x44, ocr: 0x48, comShift: 4 },
  { pin: 9, tccrA: 0x80, ocr: 0x88, comShift: 6 },
  { pin: 10, tccrA: 0x80, ocr: 0x8a, comShift: 4 },
  { pin: 11, tccrA: 0xb0, ocr: 0xb3, comShift: 6 },
  { pin: 3, tccrA: 0xb0, ocr: 0xb4, comShift: 4 },
];

/** Sample PWM duty every 1 ms of sim-time (cycle-counted → deterministic). */
const PWM_SAMPLE_CYCLES = 16_000;

export class AVRHarness implements SimHarness {
  readonly clockHz = CLOCK_HZ;

  private cpu!: CPU;
  private ports!: Record<PortName, AVRIOPort>;
  private adc!: AVRADC;
  private usart!: AVRUSART;
  private eepromBackend: CountingEepromBackend | null = null;
  private program: Uint16Array | null = null;
  private portValues: Record<PortName, number> = { B: 0, C: 0, D: 0 };
  private pinLevels = new Map<number, 0 | 1>();
  private pwmDuties = new Map<number, number>();
  private recorder = new TraceRecorder();
  /** Externally driven INPUT levels (stimulus), restored after simulated reset. */
  private externalPins = new Map<number, 0 | 1>();
  /** Last injected ADC volts per channel, restored after simulated reset. */
  private adcVolts = new Map<number, number>();
  /** Sim-time offset so trace timestamps stay monotonic across simulated resets. */
  private timeOffsetMs = 0;

  private get tMs(): number {
    return this.timeOffsetMs + this.cpu.cycles / (this.clockHz / 1000);
  }

  load(hexText: string): void {
    const program = bytesToProgramWords(parseIntelHex(hexText));
    this.program = program;
    this.timeOffsetMs = 0;
    this.bindCpu(program, { freshHarness: true });
  }

  loadProgram(words: Uint16Array): void {
    const program = new Uint16Array(0x8000 / 2);
    program.set(words);
    this.program = program;
    this.timeOffsetMs = 0;
    this.bindCpu(program, { freshHarness: true });
  }

  private bindCpu(program: Uint16Array, opts: { freshHarness: boolean }): void {
    if (opts.freshHarness) {
      this.recorder = new TraceRecorder();
      this.eepromBackend = new CountingEepromBackend((addr, value) => {
        this.recorder.recordEepromWrite(this.tMs, addr, value);
      });
      this.externalPins = new Map();
      this.adcVolts = new Map();
    }

    this.portValues = { B: 0, C: 0, D: 0 };
    this.pinLevels = new Map();
    this.pwmDuties = new Map();

    this.cpu = new CPU(program, 8192);
    this.ports = {
      B: new AVRIOPort(this.cpu, portBConfig),
      C: new AVRIOPort(this.cpu, portCConfig),
      D: new AVRIOPort(this.cpu, portDConfig),
    };
    this.adc = new AVRADC(this.cpu, adcConfig);
    for (const [ch, v] of this.adcVolts) this.adc.channelValues[ch] = v;

    this.usart = new AVRUSART(this.cpu, usart0Config, this.clockHz);
    this.usart.onByteTransmit = (v: number) =>
      this.recorder.recordSerial(this.tMs, String.fromCharCode(v));

    new AVRTimer(this.cpu, timer0Config);
    new AVRTimer(this.cpu, timer1Config);
    new AVRTimer(this.cpu, timer2Config);

    this.attachEeprom();

    for (const name of ['B', 'C', 'D'] as PortName[]) {
      this.ports[name].addListener((value: number) => {
        const old = this.portValues[name];
        this.portValues[name] = value;
        const changed = old ^ value;
        for (let bit = 0; bit < 8; bit++) {
          if (!(changed & (1 << bit))) continue;
          const pin = portBitToArduinoPin(name, bit);
          if (pin == null) continue;
          const level = this.drivenLevel(name, bit);
          if ((this.pinLevels.get(pin) ?? 0) !== level) {
            this.pinLevels.set(pin, level);
            this.recorder.recordPinEdge(this.tMs, pin, level);
          }
        }
      });
    }

    for (const [pin, level] of this.externalPins) this.setPin(pin, level);
  }

  private attachEeprom(): void {
    if (!this.eepromBackend) return;
    // The peripheral registers its read/write hooks with the CPU on construction
    // (and is retained by it for the CPU's lifetime); no field reference is needed.
    new AVREEPROM(this.cpu, this.eepromBackend, eepromConfig);
  }

  /**
   * Simulated MCU reset — reboot CPU, preserve EEPROM + trace + monotonic time.
   * External pin/ADC stimulus state is re-applied after reboot.
   */
  simulateReset(): void {
    if (!this.program) return;
    const resetAt = this.tMs;
    this.recorder.recordSimReset(resetAt);
    this.timeOffsetMs = resetAt;
    this.bindCpu(this.program, { freshHarness: false });
  }

  /** Stimulus pre-seed — not counted as a firmware EEPROM write. */
  seedEeprom(bytes: Array<{ addr: number; value: number }>): void {
    if (!this.eepromBackend) return;
    for (const { addr, value } of bytes) this.eepromBackend.seedByte(addr, value);
  }

  private drivenLevel(name: PortName, bit: number): 0 | 1 {
    const reg = PORT_REGS[name];
    const isOutput = ((this.cpu.data[reg.ddr] ?? 0) >> bit) & 1;
    const portHigh = ((this.cpu.data[reg.port] ?? 0) >> bit) & 1;
    return isOutput && portHigh ? 1 : 0;
  }

  runUntilMs(ms: number): void {
    const targetCycle = Math.round((ms - this.timeOffsetMs) * (this.clockHz / 1000));
    while (this.cpu.cycles < targetCycle) {
      const chunkEnd = Math.min(targetCycle, this.cpu.cycles + PWM_SAMPLE_CYCLES);
      while (this.cpu.cycles < chunkEnd) {
        avrInstruction(this.cpu);
        this.cpu.tick();
      }
      this.samplePwm();
    }
  }

  private samplePwm(): void {
    for (const u of PWM_UNITS) {
      const tccrA = this.cpu.data[u.tccrA] ?? 0;
      const connected = ((tccrA >> u.comShift) & 0b11) !== 0;
      if (!connected) continue;
      const ocr = (this.cpu.data[u.ocr] ?? 0) & 0xff;
      const duty = ocr / 255;
      if (this.pwmDuties.get(u.pin) !== duty) {
        this.pwmDuties.set(u.pin, duty);
        this.recorder.recordPwmSample(this.tMs, u.pin, duty);
      }
    }
  }

  getPin(pin: number): 0 | 1 {
    const m = PIN_MAP[pin];
    if (!m) return 0;
    return this.drivenLevel(m.portName, m.bit);
  }

  setPin(pin: number, level: 0 | 1): void {
    const m = PIN_MAP[pin];
    if (!m) return;
    this.externalPins.set(pin, level);
    this.ports[m.portName].setPin(m.bit, level === 1);
  }

  setAnalogVoltage(channel: number, volts: number): void {
    const clamped = Math.max(0, Math.min(5, volts));
    this.adcVolts.set(channel, clamped);
    this.adc.channelValues[channel] = clamped;
    this.recorder.recordAdcInput(this.tMs, channel, clamped);
  }

  injectSerialByte(byte: number): void {
    this.usart.writeByte(byte & 0xff);
    this.recorder.recordSerialInput(this.tMs, String.fromCharCode(byte & 0xff));
  }

  trace(): Trace {
    const finalLevels: Record<string, 0 | 1> = {};
    for (const pin of Object.keys(PIN_MAP)) finalLevels[`pin${pin}`] = this.getPin(Number(pin));
    const snapshot = this.eepromBackend?.snapshot();
    return this.recorder.finish(this.tMs, { finalLevels }, snapshot);
  }
}
