import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getInspectionScenario } from '../lib/inspectionScenarios';
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
  const scenario = getInspectionScenario(scenarioId);
  const loadedIdRef = useRef<string | null>(null);
  const [readyId, setReadyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  if (!scenario) {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 42, color: '#666' }}>404</div>
          <p>Inspection scenario &quot;{scenarioId ?? ''}&quot; was not found.</p>
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

  return <EditorPage mode="inspection" />;
};
