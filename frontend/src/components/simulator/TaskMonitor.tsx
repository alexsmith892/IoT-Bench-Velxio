import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeDigitalTiming } from '../../../../shared/digitalTiming';
import {
  taskMonitorProbeKey,
  type TaskMonitorDefinition,
  type TaskMonitorProbe,
} from '../../lib/inspectionScenarios';
import { readSimulationTimeMs } from '../../simulation/simulationTelemetry';
import {
  useTaskMonitorStore,
  type TaskMonitorCapture,
  type TaskMonitorEdge,
} from '../../store/useTaskMonitorStore';
import { sampleHoldTracePath } from './taskMonitorTrace';
import './TaskMonitor.css';

const WINDOW_MS = 5_000;

interface TaskMonitorProps {
  definition: TaskMonitorDefinition;
}

function currentLevel(initialState: 0 | 1, edges: TaskMonitorEdge[]): 0 | 1 {
  return edges.length > 0 ? edges[edges.length - 1].value : initialState;
}

function waveformPath(initialState: 0 | 1, edges: TaskMonitorEdge[], endMs: number): string {
  const startMs = Math.max(0, endMs - WINDOW_MS);
  let level = initialState;
  for (const edge of edges) {
    if (edge.tMs <= startMs) level = edge.value;
    else break;
  }
  const x = (time: number) => ((time - startMs) / WINDOW_MS) * 1000;
  const y = (value: 0 | 1) => (value ? 16 : 64);
  const parts = [`M 0 ${y(level)}`];
  for (const edge of edges) {
    if (edge.tMs < startMs || edge.tMs > endMs) continue;
    const edgeX = Math.max(0, Math.min(1000, x(edge.tMs)));
    parts.push(`L ${edgeX} ${y(level)}`, `L ${edgeX} ${y(edge.value)}`);
    level = edge.value;
  }
  parts.push(`L 1000 ${y(level)}`);
  return parts.join(' ');
}

function DigitalTimingProbe({
  probe,
  capture,
  timeMs,
}: {
  probe: Extract<TaskMonitorProbe, { channel: 'pinEdges' }>;
  capture: Extract<TaskMonitorCapture, { channel: 'pinEdges' }>;
  timeMs: number;
}) {
  const timing = useMemo(() => analyzeDigitalTiming(capture.edges), [capture.edges]);
  const level = currentLevel(capture.initialState, capture.edges);
  const endMs = Math.max(WINDOW_MS, timeMs);
  return (
    <article className="task-probe" data-channel="pinEdges">
      <header className="task-probe__header">
        <div>
          <span className="task-probe__channel">DIGITAL · D{probe.pin}</span>
          <strong>{probe.label}</strong>
        </div>
        {probe.derive.includes('level') && (
          <span className={`task-probe__badge task-probe__badge--${level ? 'high' : 'low'}`}>
            {level ? 'HIGH' : 'LOW'}
          </span>
        )}
      </header>
      {probe.derive.includes('digitalTiming') && (
        <div className="task-probe__metrics">
          <span>
            Frequency{' '}
            <strong>{timing.freqHz == null ? '—' : `${timing.freqHz.toFixed(3)} Hz`}</strong>
          </span>
          <span>
            Period{' '}
            <strong>
              {timing.meanPeriodMs == null ? '—' : `${timing.meanPeriodMs.toFixed(2)} ms`}
            </strong>
          </span>
          <span>
            Duty{' '}
            <strong>
              {timing.dutyMean == null ? '—' : `${(timing.dutyMean * 100).toFixed(2)}%`}
            </strong>
          </span>
          <span>
            Capture <strong>{timing.edgeCount} edges</strong>
          </span>
        </div>
      )}
      {probe.derive.includes('waveform') && (
        <div className="task-probe__trace">
          <svg
            viewBox="0 0 1000 80"
            preserveAspectRatio="none"
            aria-label={`${probe.label} waveform`}
          >
            <line x1="0" x2="1000" y1="16" y2="16" />
            <line x1="0" x2="1000" y1="64" y2="64" />
            <path d={waveformPath(capture.initialState, capture.edges, endMs)} />
          </svg>
        </div>
      )}
    </article>
  );
}

function SerialLogProbe({
  probe,
  capture,
}: {
  probe: Extract<TaskMonitorProbe, { channel: 'serial' }>;
  capture: Extract<TaskMonitorCapture, { channel: 'serial' }>;
}) {
  const logRef = useRef<HTMLPreElement>(null);
  const followTailRef = useRef(true);
  const text = capture.bytes
    .map((entry) => entry.char)
    .join('')
    .slice(-4_000);
  const last = capture.bytes[capture.bytes.length - 1];
  useEffect(() => {
    const log = logRef.current;
    if (log && followTailRef.current) log.scrollTop = log.scrollHeight;
  }, [capture.bytes.length]);
  return (
    <article className="task-probe" data-channel="serial">
      <header className="task-probe__header">
        <div>
          <span className="task-probe__channel">SERIAL</span>
          <strong>{probe.label}</strong>
        </div>
        <span className="task-probe__count">{capture.bytes.length} bytes</span>
      </header>
      <pre
        ref={logRef}
        className="task-probe__serial"
        onScroll={(event) => {
          const log = event.currentTarget;
          followTailRef.current = log.scrollHeight - log.scrollTop - log.clientHeight < 12;
        }}
      >
        {text || 'No serial output captured'}
      </pre>
      <small className="task-probe__foot">
        Last byte:{' '}
        {last
          ? `${last.tMs.toFixed(2)} ms · 0x${last.byte.toString(16).padStart(2, '0').toUpperCase()}`
          : '—'}
      </small>
    </article>
  );
}

function ValueProbe({
  probe,
  capture,
  timeMs,
}: {
  probe: Extract<TaskMonitorProbe, { channel: 'pwm' | 'adc' }>;
  capture: Extract<TaskMonitorCapture, { channel: 'pwm' | 'adc' }>;
  timeMs: number;
}) {
  const latest = capture.samples[capture.samples.length - 1];
  const isPwm = probe.channel === 'pwm';
  const formatted = latest
    ? isPwm
      ? `${(latest.value * 100).toFixed(2)}%`
      : `${latest.value.toFixed(3)} V`
    : '—';
  const path = sampleHoldTracePath(capture.samples, Math.max(WINDOW_MS, timeMs), 0, isPwm ? 1 : 5);
  return (
    <article className="task-probe" data-channel={probe.channel}>
      <header className="task-probe__header">
        <div>
          <span className="task-probe__channel">
            {isPwm ? `PWM · D${probe.pin}` : `ADC · A${probe.pin}`}
          </span>
          <strong>{probe.label}</strong>
        </div>
        {probe.derive.includes('value') && <span className="task-probe__value">{formatted}</span>}
      </header>
      {probe.derive.includes('trace') && (
        <div className="task-probe__trace task-probe__trace--analog">
          <svg viewBox="0 0 1000 80" preserveAspectRatio="none" aria-label={`${probe.label} trace`}>
            <line x1="0" x2="1000" y1="70" y2="70" />
            {path && <path d={path} />}
          </svg>
        </div>
      )}
      <small className="task-probe__foot">
        {capture.samples.length} samples · last {latest ? `${latest.tMs.toFixed(2)} ms` : '—'}
      </small>
    </article>
  );
}

function ProbeWidget({
  probe,
  capture,
  timeMs,
}: {
  probe: TaskMonitorProbe;
  capture: TaskMonitorCapture;
  timeMs: number;
}) {
  if (probe.channel === 'pinEdges' && capture.channel === 'pinEdges') {
    return <DigitalTimingProbe probe={probe} capture={capture} timeMs={timeMs} />;
  }
  if (probe.channel === 'serial' && capture.channel === 'serial') {
    return <SerialLogProbe probe={probe} capture={capture} />;
  }
  if ((probe.channel === 'pwm' || probe.channel === 'adc') && capture.channel === probe.channel) {
    return <ValueProbe probe={probe} capture={capture} timeMs={timeMs} />;
  }
  return null;
}

function emptyCaptureForProbe(probe: TaskMonitorProbe): TaskMonitorCapture {
  if (probe.channel === 'pinEdges') return { channel: 'pinEdges', initialState: 0, edges: [] };
  if (probe.channel === 'serial') return { channel: 'serial', bytes: [] };
  return { channel: probe.channel, samples: [] };
}

export function TaskMonitor({ definition }: TaskMonitorProps) {
  const status = useTaskMonitorStore((state) => state.status);
  const captures = useTaskMonitorStore((state) => state.captures);
  const stoppedAtMs = useTaskMonitorStore((state) => state.stoppedAtMs);
  const [liveTimeMs, setLiveTimeMs] = useState(0);

  useEffect(() => {
    if (status !== 'running') return;
    const update = () => setLiveTimeMs(readSimulationTimeMs(definition.boardId));
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [definition.boardId, status]);

  const timeMs =
    status === 'idle' ? 0 : status === 'stopped' ? (stoppedAtMs ?? liveTimeMs) : liveTimeMs;
  const message =
    status === 'idle'
      ? 'Run the simulation to begin a fresh live capture.'
      : status === 'stopped'
        ? 'Simulation stopped. The final capture is frozen for inspection.'
        : 'Live browser observations are updating from simulated-time events.';

  return (
    <section className="task-monitor" aria-label="Benchmark Task Monitor">
      <header className="task-monitor__header">
        <div>
          <div className="task-monitor__eyebrow">DECLARATIVE TASK MONITOR</div>
          <div className="task-monitor__title">
            {definition.probes.length} live probes · {message}
          </div>
        </div>
        <div className="task-monitor__clock">
          <span>SIMULATED TIME</span>
          <strong>{timeMs.toFixed(1)} ms</strong>
        </div>
      </header>
      <div className="task-monitor__notice">
        Browser-debug measurements are RAF-paced and approximate. They are never used for benchmark
        grading.
      </div>
      <div className="task-monitor__grid">
        {definition.probes.map((probe) => {
          const key = taskMonitorProbeKey(probe);
          const capture = captures[key] ?? emptyCaptureForProbe(probe);
          return <ProbeWidget key={key} probe={probe} capture={capture} timeMs={timeMs} />;
        })}
      </div>
    </section>
  );
}
