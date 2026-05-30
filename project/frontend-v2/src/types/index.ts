// ── Coordinates ──
export type LatLng = [number, number];

// ── Application mode ──
export type AppMode = 'route-search' | 'station-management';

// ── Location (origin/destination) ──
export interface StationInfo {
  id: number;
  name: string;
  japaneseName?: string;
  lat: number;
  lng: number;
}

export interface Location {
  type: 'station' | 'coordinate';
  station?: StationInfo;
  coordinates: LatLng;
  displayName: string;
}

// ── Path segment from backend ──
// Backend returns: [[lat, lon], name, type, is_subway, way_name]
export type PathSegmentType = 'stop' | 'entrance' | 'endpoint' | 'node';

export interface PathSegment {
  coord: LatLng;
  name: string | null;
  type: PathSegmentType;
  isSubway: boolean;
  wayName: string | null;
}

// ── Waypoint from backend ──
export interface Waypoint {
  name: string;
  type: string;
}

// ── Single route result (normalized from backend) ──
export interface RouteResult {
  path: PathSegment[];
  distanceMeters: number;
  estimateTimeMinutes: number;
  waypoints: Waypoint[];
  transfers: number;
  mainLine: string;
}

// ── Raw backend pathfind response ──
export interface RawPathResult {
  path: Array<[LatLng, string | null, string, boolean, string | null]>;
  distance_meters: number;
  estimate_time: number;
  waypoints: Waypoint[];
}

export interface PathfindResponse {
  shortest: RawPathResult | null;
  fastest: RawPathResult | null;
}

// ── Graph edges response ──
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
  blocked_nodes?: number[];
  blocked_track_nodes?: number[];
}

// ── OSM data ──
export interface OSMNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

export interface MapDataResponse {
  elements: (OSMNode | Record<string, unknown>)[];
}

// ── Toggle response ──
export interface ToggleResponse {
  node_id: number;
  blocked: boolean;
}

export interface UnblockAllResponse {
  unblocked_count: number;
}

// ── Context menu state ──
export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  latlng: LatLng;
  station?: StationInfo;
}

// ── Station list item (for sidebar) ──
export interface StationListItem {
  id: number;
  name: string;
  japaneseName: string;
  lat: number;
  lng: number;
  isDisabled: boolean;
}
