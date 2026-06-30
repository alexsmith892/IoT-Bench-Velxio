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
// We READ the OCR/TCCR registers to derive duty rather than capture the fast PWM
// edges: the timer compare-output OVERRIDES the PORT bit the DDR-aware edge
// recorder reads, so an analogWrite pin would log no driven edge. Addresses are
// the ATmega328P data-space regs (matching avr8js timer{0,1,2}Config). Each unit
// is connected (actively driving PWM) only when its COMnx bits in TCCRnA are
// non-zero — that is what Arduino's analogWrite() sets. Duty = OCR(low 8 bits) /
// 255 (analogWrite's 0..255 range; TOP=255 on all three Arduino PWM timers).
interface PwmUnit {
  pin: number;
  /** TCCRnA address (carries the COMnx output-mode bits). */
  tccrA: number;
  /** OCRnx address (compare value; low byte used for the 0..255 duty). */
  ocr: number;
  /** Bit offset of this unit's COMnx field in TCCRnA (6 = unit A, 4 = unit B). */
  comShift: 6 | 4;
}
const PWM_UNITS: PwmUnit[] = [
  { pin: 6, tccrA: 0x44, ocr: 0x47, comShift: 6 }, // OC0A / PD6
  { pin: 5, tccrA: 0x44, ocr: 0x48, comShift: 4 }, // OC0B / PD5
  { pin: 9, tccrA: 0x80, ocr: 0x88, comShift: 6 }, // OC1A / PB1
  { pin: 10, tccrA: 0x80, ocr: 0x8a, comShift: 4 }, // OC1B / PB2
  { pin: 11, tccrA: 0xb0, ocr: 0xb3, comShift: 6 }, // OC2A / PB3
  { pin: 3, tccrA: 0xb0, ocr: 0xb4, comShift: 4 }, // OC2B / PD3
];

/** Sample PWM duty every 1 ms of sim-time (cycle-counted → deterministic). */
const PWM_SAMPLE_CYCLES = 16_000;

export class AVRHarness implements SimHarness {
  readonly clockHz = CLOCK_HZ;

  private cpu!: CPU;
  private ports!: Record<PortName, AVRIOPort>;
  private adc!: AVRADC;
  private usart!: AVRUSART;
  private portValues: Record<PortName, number> = { B: 0, C: 0, D: 0 };
  /** Last *driven output* level recorded per Arduino pin (DDR-aware). */
  private pinLevels = new Map<number, 0 | 1>();
  /** Last PWM duty recorded per pin, to emit a sample only on change. */
  private pwmDuties = new Map<number, number>();
  private recorder = new TraceRecorder();

  /** Simulated milliseconds elapsed since reset. */
  private get tMs(): number {
    return this.cpu.cycles / (this.clockHz / 1000);
  }

  load(hexText: string): void {
    const program = bytesToProgramWords(parseIntelHex(hexText));
    this.bindCpu(program);
  }

  /** Load a pre-assembled instruction-word image (used by unit tests). */
  loadProgram(words: Uint16Array): void {
    const program = new Uint16Array(0x8000 / 2);
    program.set(words);
    this.bindCpu(program);
  }

  private bindCpu(program: Uint16Array): void {
    this.recorder = new TraceRecorder();
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

    this.usart = new AVRUSART(this.cpu, usart0Config, this.clockHz);
    this.usart.onByteTransmit = (v: number) =>
      this.recorder.recordSerial(this.tMs, String.fromCharCode(v));

    // Timers self-register clock callbacks on the CPU in their constructors;
    // we don't read them back, but they must exist to advance PWM/millis.
    new AVRTimer(this.cpu, timer0Config);
    new AVRTimer(this.cpu, timer1Config);
    new AVRTimer(this.cpu, timer2Config);

    for (const name of ['B', 'C', 'D'] as PortName[]) {
      this.ports[name].addListener((value: number) => {
        const old = this.portValues[name];
        this.portValues[name] = value;
        const changed = old ^ value;
        for (let bit = 0; bit < 8; bit++) {
          if (!(changed & (1 << bit))) continue;
          const pin = portBitToArduinoPin(name, bit);
          if (pin == null) continue;
          // Record the *driven* level, not the raw PORT bit: a PORT write on an
          // input pin toggles the pullup, not an output — it must not look like
          // a driven edge. Only emit an edge when the driven level changed.
          const level = this.drivenLevel(name, bit);
          // Pins reset to input/low → implicit baseline 0; a missing prior
          // level must not look like a transition.
          if ((this.pinLevels.get(pin) ?? 0) !== level) {
            this.pinLevels.set(pin, level);
            this.recorder.recordPinEdge(this.tMs, pin, level);
          }
        }
      });
    }
  }

  /**
   * The level a pin is actively *driving*: HIGH only when configured as output
   * (DDR bit set) AND the PORT bit is set. INPUT / INPUT_PULLUP pins drive
   * nothing → 0. Reads live DDR + PORT from the CPU data space.
   */
  private drivenLevel(name: PortName, bit: number): 0 | 1 {
    const reg = PORT_REGS[name];
    const isOutput = ((this.cpu.data[reg.ddr] ?? 0) >> bit) & 1;
    const portHigh = ((this.cpu.data[reg.port] ?? 0) >> bit) & 1;
    return isOutput && portHigh ? 1 : 0;
  }

  runUntilMs(ms: number): void {
    const targetCycle = Math.round(ms * (this.clockHz / 1000));
    // Run in 1 ms cycle-counted chunks so PWM duty is sampled at a deterministic
    // cadence (no wall-clock). Instruction order is unchanged, so traces stay
    // byte-identical across runs.
    while (this.cpu.cycles < targetCycle) {
      const chunkEnd = Math.min(targetCycle, this.cpu.cycles + PWM_SAMPLE_CYCLES);
      while (this.cpu.cycles < chunkEnd) {
        avrInstruction(this.cpu);
        this.cpu.tick();
      }
      this.samplePwm();
    }
  }

  /**
   * Read each PWM unit's OCR/COM state and record a duty sample when it changes.
   * Duty is only meaningful while the compare output is connected (COMnx ≠ 0),
   * which is exactly what analogWrite() sets; a disconnected unit is a plain GPIO
   * pin captured by the edge recorder instead.
   */
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

  /** Driven output level of a pin (0/1) — DDR-aware; INPUT_PULLUP reads 0. */
  getPin(pin: number): 0 | 1 {
    const m = PIN_MAP[pin];
    if (!m) return 0;
    return this.drivenLevel(m.portName, m.bit);
  }

  /**
   * Drive the external value an INPUT pin reads (avr8js `AVRIOPort.setPin`).
   * `level` is the logic level the firmware's `digitalRead`/PIN register sees —
   * for a button to GND with `INPUT_PULLUP`, drive 0 = pressed, 1 = released.
   * No effect (and not meaningful) on a pin the firmware has set to OUTPUT.
   */
  setPin(pin: number, level: 0 | 1): void {
    const m = PIN_MAP[pin];
    if (!m) return;
    this.ports[m.portName].setPin(m.bit, level === 1);
  }

  /** Inject an ADC channel voltage (clamped 0–5 V) and echo it into the trace. */
  setAnalogVoltage(channel: number, volts: number): void {
    const clamped = Math.max(0, Math.min(5, volts));
    this.adc.channelValues[channel] = clamped;
    this.recorder.recordAdcInput(this.tMs, channel, clamped);
  }

  /**
   * Deliver one RX byte to USART0 (what the firmware's `Serial.read()` sees) and
   * echo it into the trace. avr8js paces the byte through its RX machinery; the
   * caller (the stimulus scheduler) spaces bytes by baud so each completes before
   * the next. `byte` is 0–255.
   */
  injectSerialByte(byte: number): void {
    this.usart.writeByte(byte & 0xff);
    this.recorder.recordSerialInput(this.tMs, String.fromCharCode(byte & 0xff));
  }

  trace(): Trace {
    const finalLevels: Record<string, 0 | 1> = {};
    for (const pin of Object.keys(PIN_MAP)) finalLevels[`pin${pin}`] = this.getPin(Number(pin));
    return this.recorder.finish(this.tMs, { finalLevels });
  }
}
