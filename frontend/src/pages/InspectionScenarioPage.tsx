import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  loadInspectionScenario,
  type InspectionScenario,
  useRuntimeBenchApi,
} from '../lib/inspectionScenarios';
import { BenchScenarioNotFoundError } from '../services/benchScenariosService';
import { loadVlxPayload } from '../utils/vlxFile';
import { useCompileLogsStore } from '../store/useCompileLogsStore';
import { useEditorStore } from '../store/useEditorStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useProjectStore } from '../store/useProjectStore';
import { EditorPage } from './EditorPage';

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      minHeight: '100vh',
      background: '#1e1e1e',
      color: '#ccc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}
  >
    {children}
  </div>
);

export const InspectionScenarioPage: React.FC = () => {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const [scenario, setScenario] = useState<InspectionScenario | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(true);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const loadedIdRef = useRef<string | null>(null);
  const [readyId, setReadyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadedIdRef.current = null;
    setScenario(null);
    setScenarioLoading(true);
    setScenarioError(null);
    setReadyId(null);
    setLoadError(null);

    void loadInspectionScenario(scenarioId)
      .then((loaded) => {
        if (cancelled) return;
        setScenario(loaded);
        if (!loaded) {
          setScenarioError(`Inspection scenario "${scenarioId ?? ''}" was not found.`);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof BenchScenarioNotFoundError) {
          setScenarioError(error.message);
          return;
        }
        setScenarioError(
          error instanceof Error ? error.message : 'Unknown scenario loading error.',
        );
      })
      .finally(() => {
        if (!cancelled) setScenarioLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scenarioId]);

  useEffect(() => {
    if (!scenario || loadedIdRef.current === scenario.id) return;
    loadedIdRef.current = scenario.id;
    setReadyId(null);
    setLoadError(null);

    try {
      useProjectStore.getState().clearCurrentProject();
      useElectricalStore.getState().reset();
      useElectricalStore.getState().setPaused(false);
      useCompileLogsStore.getState().setLogs([]);
      loadVlxPayload(scenario.project);
      useEditorStore.getState().setViewMode('both');
      // Store bootstrap is intentionally effect-driven; rendering the editor
      // before these synchronous store writes would briefly show stale files.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReadyId(scenario.id);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unknown fixture loading error.');
    }
  }, [scenario]);

  if (scenarioLoading) {
    return <Shell>Loading inspection scenario…</Shell>;
  }

  if (scenarioError || !scenario) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', maxWidth: 640, padding: 24 }}>
          <div style={{ fontSize: 42, color: '#666' }}>404</div>
          <p>{scenarioError ?? `Inspection scenario "${scenarioId ?? ''}" was not found.`}</p>
          {useRuntimeBenchApi ? (
            <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 16 }}>
              If you added this scenario recently, run{' '}
              <code>cd bench &amp;&amp; npm run export:inspection</code>, then refresh.
            </p>
          ) : null}
        </div>
      </Shell>
    );
  }

  if (loadError) {
    return (
      <Shell>
        <div style={{ maxWidth: 640, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 18 }}>Could not load {scenario.title}</h1>
          <pre style={{ color: '#f87171', whiteSpace: 'pre-wrap' }}>{loadError}</pre>
        </div>
      </Shell>
    );
  }

  if (readyId !== scenario.id) {
    return <Shell>Loading {scenario.title}…</Shell>;
  }

  return <EditorPage mode="inspection" taskMonitor={scenario.taskMonitor} />;
};
