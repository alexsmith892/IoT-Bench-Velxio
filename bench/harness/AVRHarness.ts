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

export class AVRHarness implements SimHarness {
  readonly clockHz = CLOCK_HZ;

  private cpu!: CPU;
  private ports!: Record<PortName, AVRIOPort>;
  private adc!: AVRADC;
  private usart!: AVRUSART;
  private portValues: Record<PortName, number> = { B: 0, C: 0, D: 0 };
  /** Last *driven output* level recorded per Arduino pin (DDR-aware). */
  private pinLevels = new Map<number, 0 | 1>();
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
    while (this.cpu.cycles < targetCycle) {
      avrInstruction(this.cpu);
      this.cpu.tick();
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

  trace(): Trace {
    const finalLevels: Record<string, 0 | 1> = {};
    for (const pin of Object.keys(PIN_MAP)) finalLevels[`pin${pin}`] = this.getPin(Number(pin));
    return this.recorder.finish(this.tMs, { finalLevels });
  }
}
