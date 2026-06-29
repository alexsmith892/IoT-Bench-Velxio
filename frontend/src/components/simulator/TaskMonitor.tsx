import { useEffect, useMemo, useState } from 'react';
import { analyzeDigitalTiming } from '../../../../shared/digitalTiming';
import type { TaskMonitorDefinition } from '../../lib/inspectionScenarios';
import { readSimulationTimeMs } from '../../simulation/simulationTelemetry';
import { useTaskMonitorStore, type TaskMonitorEdge } from '../../store/useTaskMonitorStore';
import './TaskMonitor.css';

const WINDOW_MS = 5_000;
const EVENT_ROWS = 50;

interface TaskMonitorProps {
  definition: TaskMonitorDefinition;
}

function formatMs(value: number | null, digits = 1): string {
  return value == null ? '—' : `${value.toFixed(digits)} ms`;
}

function formatHz(value: number | null): string {
  return value == null ? '—' : `${value.toFixed(3)} Hz`;
}

function currentLevel(initialState: 0 | 1, edges: TaskMonitorEdge[]): 0 | 1 {
  return edges.length > 0 ? edges[edges.length - 1].value : initialState;
}

function waveformPath(initialState: 0 | 1, edges: TaskMonitorEdge[], windowEndMs: number): string {
  const startMs = Math.max(0, windowEndMs - WINDOW_MS);
  let level = initialState;
  for (const edge of edges) {
    if (edge.tMs <= startMs) level = edge.value;
    else break;
  }

  const x = (time: number) => ((time - startMs) / WINDOW_MS) * 1000;
  const y = (value: 0 | 1) => (value ? 18 : 72);
  const parts = [`M 0 ${y(level)}`];
  for (const edge of edges) {
    if (edge.tMs < startMs || edge.tMs > windowEndMs) continue;
    const edgeX = Math.max(0, Math.min(1000, x(edge.tMs)));
    parts.push(`L ${edgeX} ${y(level)}`, `L ${edgeX} ${y(edge.value)}`);
    level = edge.value;
  }
  parts.push(`L 1000 ${y(level)}`);
  return parts.join(' ');
}

export function TaskMonitor({ definition }: TaskMonitorProps) {
  const status = useTaskMonitorStore((state) => state.status);
  const initialState = useTaskMonitorStore((state) => state.initialState);
  const edges = useTaskMonitorStore((state) => state.edges);
  const stoppedAtMs = useTaskMonitorStore((state) => state.stoppedAtMs);
  const [liveTimeMs, setLiveTimeMs] = useState(0);

  useEffect(() => {
    if (status !== 'running') return;
    const update = () => setLiveTimeMs(readSimulationTimeMs(definition.source.boardId));
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [definition.source.boardId, status]);

  const timeMs =
    status === 'idle' ? 0 : status === 'stopped' ? (stoppedAtMs ?? liveTimeMs) : liveTimeMs;
  const timing = useMemo(() => analyzeDigitalTiming(edges), [edges]);
  const level = currentLevel(initialState, edges);
  const lastEdge = edges[edges.length - 1];
  const currentPhaseMs = lastEdge ? Math.max(0, timeMs - lastEdge.tMs) : timeMs;
  const targetPhaseMs = 1000 / definition.target.frequencyHz;
  const targetHighMs = targetPhaseMs * definition.target.dutyCycle;
  const targetLowMs = targetPhaseMs - targetHighMs;
  const waveformEndMs = Math.max(WINDOW_MS, timeMs);
  const waveformStartMs = Math.max(0, waveformEndMs - WINDOW_MS);
  const path = waveformPath(initialState, edges, waveformEndMs);

  let message = 'Run the simulation to begin a fresh live capture.';
  if (status === 'running' && edges.length === 0) message = 'Waiting for the first LED transition…';
  else if (status === 'running' && timing.periods.length < definition.target.minPeriods) {
    message = `Collecting complete periods (${timing.periods.length}/${definition.target.minPeriods})…`;
  } else if (status === 'running')
    message = 'Live measurements update from simulated pin transitions.';
  else if (status === 'stopped')
    message = 'Simulation stopped. The final capture is frozen for inspection.';

  const rows = edges.slice(-EVENT_ROWS).reverse();

  return (
    <section className="task-monitor" aria-label="LED Task Monitor">
      <header className="task-monitor__header">
        <div>
          <div className="task-monitor__eyebrow">LED TASK MONITOR</div>
          <div className="task-monitor__title">
            <span className={`task-monitor__led task-monitor__led--${level ? 'high' : 'low'}`} />
            {definition.source.label} · D{definition.source.pin}
            <span className={`task-monitor__state task-monitor__state--${level ? 'high' : 'low'}`}>
              {level ? 'HIGH' : 'LOW'}
            </span>
          </div>
        </div>
        <div className="task-monitor__clock">
          <span>SIMULATED TIME</span>
          <strong>{timeMs.toFixed(1)} ms</strong>
        </div>
      </header>

      <div className="task-monitor__body">
        <div className="task-monitor__main">
          <div className="task-monitor__notice">{message}</div>

          <div className="task-monitor__metrics">
            <div className="task-monitor__metric task-monitor__metric--target">
              <span>Target</span>
              <strong>
                {definition.target.frequencyHz} Hz / {definition.target.dutyCycle * 100}%
              </strong>
              <small>
                ±{definition.target.tolerancePct}% · {definition.target.minPeriods} periods
              </small>
            </div>
            <div className="task-monitor__metric">
              <span>Frequency</span>
              <strong>{formatHz(timing.freqHz)}</strong>
            </div>
            <div className="task-monitor__metric">
              <span>Period</span>
              <strong>{formatMs(timing.meanPeriodMs)}</strong>
            </div>
            <div className="task-monitor__metric">
              <span>Duty cycle</span>
              <strong>
                {timing.dutyMean == null ? '—' : `${(timing.dutyMean * 100).toFixed(2)}%`}
              </strong>
            </div>
            <div className="task-monitor__metric">
              <span>Last HIGH</span>
              <strong>{formatMs(timing.latestHighMs)}</strong>
              <small>target {formatMs(targetHighMs, 0)}</small>
            </div>
            <div className="task-monitor__metric">
              <span>Last LOW</span>
              <strong>{formatMs(timing.latestLowMs)}</strong>
              <small>target {formatMs(targetLowMs, 0)}</small>
            </div>
            <div className="task-monitor__metric">
              <span>Current phase</span>
              <strong>{formatMs(currentPhaseMs)}</strong>
            </div>
            <div className="task-monitor__metric">
              <span>Capture</span>
              <strong>{timing.edgeCount} edges</strong>
              <small>{timing.periods.length} complete periods</small>
            </div>
          </div>

          <div className="task-monitor__waveform">
            <div className="task-monitor__waveform-label">
              <span>HIGH</span>
              <span>LOW</span>
            </div>
            <svg
              viewBox="0 0 1000 90"
              preserveAspectRatio="none"
              role="img"
              aria-label="Five second LED digital waveform"
            >
              {Array.from({ length: 11 }, (_, index) => (
                <line key={index} x1={index * 100} x2={index * 100} y1="0" y2="90" />
              ))}
              <path d={path} />
            </svg>
            <div className="task-monitor__ruler">
              {Array.from({ length: 11 }, (_, index) => (
                <span key={index}>
                  {Math.round(waveformStartMs + index * 500).toLocaleString()} ms
                </span>
              ))}
            </div>
          </div>
        </div>

        <aside className="task-monitor__events">
          <div className="task-monitor__events-title">
            LATEST TRANSITIONS <span>{Math.min(edges.length, EVENT_ROWS)}</span>
          </div>
          <div className="task-monitor__event-head">
            <span>TIME</span>
            <span>STATE</span>
            <span>PHASE</span>
          </div>
          <div className="task-monitor__event-list">
            {rows.length === 0 ? (
              <div className="task-monitor__empty">No transitions captured</div>
            ) : (
              rows.map((edge, reverseIndex) => {
                const originalIndex = edges.length - 1 - reverseIndex;
                const previous = edges[originalIndex - 1];
                return (
                  <div className="task-monitor__event" key={`${edge.tMs}-${edge.value}`}>
                    <span>{edge.tMs.toFixed(2)} ms</span>
                    <strong className={edge.value ? 'is-high' : 'is-low'}>
                      {edge.value ? 'HIGH' : 'LOW'}
                    </strong>
                    <span>{previous ? `${(edge.tMs - previous.tMs).toFixed(2)} ms` : '—'}</span>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
