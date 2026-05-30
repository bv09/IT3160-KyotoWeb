// ── Coordinate ──
export type LatLng = [number, number];

// ── Path segment types ──
export type PathSegmentType = 'stop' | 'entrance' | 'endpoint' | 'node';

export interface PathSegment {
  coord: LatLng;
  name: string | null;
  type: PathSegmentType;
  isSubway?: boolean;
  wayName?: string | null;
}

// ── Single path result ──
export interface PathResult {
  path: PathSegment[];
  distance_meters: number;
  estimate_time: number;
  waypoints?: { name: string; type: string }[];
}

// ── API responses ──
export interface RouteResponse {
  shortest: PathResult | null;
  fastest: PathResult | null;
}

export interface GraphEdge {
  from: number;
  to: number;
  from_name: string | null;
  to_name: string | null;
  distance: number;
}

export interface GraphEdgesResponse {
  edges: GraphEdge[];
  nodes: Record<string, LatLng>;
  node_ways?: Record<string, number[]>;
  stop_neighbor_nodes?: Record<string, number[]>;
  blocked_nodes?: number[];
  blocked_track_nodes?: number[];
}

export interface OSMNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

export interface MapDataResponse {
  elements: OSMNode[];
}

export interface ToggleResponse {
  node_id: number;
  blocked: boolean;
}

export interface UnblockAllResponse {
  unblocked_count: number;
}

// ── App state ──
export type AppPhase = 'idle' | 'selecting' | 'loading';

export interface RouteResult {
  path: PathSegment[];
  distanceMeters: number;
  estimateTime: number;
  waypoints: { name: string; type: string }[];
}
