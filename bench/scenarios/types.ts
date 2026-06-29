/**
 * Minimal structural type for a Velxio circuit project, shared between the
 * visual inspection registry (Vite/browser) and the headless grading harness
 * (Node). It is a structural subset of `frontend/src/utils/vlxFile.ts`'s
 * `VlxPayload` — intentionally re-declared here so the bench package stays
 * fully decoupled from the frontend's store-coupled module graph.
 *
 * The two consumers share ONE source of truth for the wiring (see
 * `scenarios/<id>/circuit.ts`); only the mechanism for loading the firmware
 * text differs (Vite `?raw` import vs Node `fs.readFileSync`).
 */

export interface CircuitWireEndpoint {
  componentId: string;
  pinName: string;
  x: number;
  y: number;
}

export interface CircuitWire {
  id: string;
  start: CircuitWireEndpoint;
  end: CircuitWireEndpoint;
  waypoints?: Array<{ x: number; y: number }>;
  color: string;
}

export interface CircuitProject {
  format: 'velxio-project';
  version: number;
  exportedAt: string;
  name?: string;
  boards: Array<{
    id: string;
    boardKind: string;
    x: number;
    y: number;
    activeFileGroupId: string;
    languageMode?: string;
    serialBaudRate?: number;
    libraries?: string[];
  }>;
  fileGroups: Record<string, Array<{ name: string; content: string }>>;
  components: Array<{
    id: string;
    metadataId: string;
    x: number;
    y: number;
    properties: Record<string, unknown>;
  }>;
  wires: CircuitWire[];
  activeBoardId: string | null;
}
