/** Core TypeScript types matching the backend API v2 responses. */

// ── Geometry ──────────────────────────────────────────────────────

export type LatLng = [number, number];

export interface StopPoint {
  lat: number;
  lon: number;
  name: string | null;
}

// ── Stops ─────────────────────────────────────────────────────────

export interface StopSummary {
  id: number;
  osm_id: number;
  name: string;
  type: "stop_position" | "platform" | "entrance" | "station";
  mode: string;
  lat: number;
  lon: number;
}

export interface StopDetail extends StopSummary {
  wheelchair: boolean;
  routes: {
    id: number;
    ref: string;
    name: string;
    type: string;
    colour: string | null;
  }[];
}

// ── Routes ────────────────────────────────────────────────────────

export interface RouteSummary {
  id: number;
  osm_id: number;
  ref: string;
  name: string;
  type: string;
  colour: string | null;
  network: string | null;
  operator: string | null;
  from: string;
  to: string;
}

export interface RouteDetail extends RouteSummary {
  stops: {
    stop_id: number;
    name: string;
    sequence: number;
    role: string;
    lat: number;
    lon: number;
  }[];
}

// ── Routing ───────────────────────────────────────────────────────

export interface RouteSummaryData {
  total_distance_m: number;
  total_time_s: number;
  total_transfers: number;
  walking_distance_m: number;
  algorithm: string;
}

export interface LegBase {
  type: "walk" | "transit";
  from: StopPoint;
  to: StopPoint;
  distance_m: number;
  time_s: number;
  geometry: LatLng[];
}

export interface TransitLeg extends LegBase {
  type: "transit";
  route_id: number;
  route_ref: string | null;
  route_name: string | null;
  route_colour: string | null;
  intermediate_stops: string[];
}

export interface WalkLeg extends LegBase {
  type: "walk";
}

export type Leg = TransitLeg | WalkLeg;

export type PathPointType = "stop" | "entrance" | "endpoint" | "waypoint";

export type PathPoint = [LatLng, string | null, PathPointType];

export interface RouteResult {
  summary: RouteSummaryData;
  legs: Leg[];
  path: PathPoint[];
}

export interface RouteRequestBody {
  start: LatLng;
  end: LatLng;
  algorithm?: "dijkstra" | "astar" | "transfer_aware";
  constraints?: {
    max_transfers?: number;
    transfer_penalty_s?: number;
    avoid_routes?: number[];
    optimize?: "time" | "distance" | "transfers";
  };
  include_walking?: boolean;
  include_legs?: boolean;
}

// ── Graph ─────────────────────────────────────────────────────────

export interface GraphEdge {
  from: number;
  to: number;
  from_name: string | null;
  to_name: string | null;
  distance: number;
  edge_type: "subway" | "walk" | "transfer" | "entrance" | "unknown";
  route_id: number | null;
}

export interface GraphData {
  edges: GraphEdge[];
  nodes: Record<string, LatLng>;
  node_ways: Record<string, number[]>;
  blocked_nodes: number[];
  blocked_track_nodes: number[];
}

// ── Map Data ──────────────────────────────────────────────────────

export interface OsmElement {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

export interface MapData {
  elements: OsmElement[];
}

// ── Health ────────────────────────────────────────────────────────

export interface HealthStatus {
  status: string;
  database: boolean;
  database_connected?: boolean;
  database_error?: string;
  graph?: {
    nodes: number;
    edges: number;
    routes: number;
  };
}

// ── App State ─────────────────────────────────────────────────────

export type AppRole = "user" | "admin";
export type TransportMode = "subway" | "bus" | "walk";

// ── Station (internal app representation) ─────────────────────────

export interface StationData {
  id: number;
  lat: number;
  lon: number;
  name: string;
  type: string;
  isBlocked: boolean;
}