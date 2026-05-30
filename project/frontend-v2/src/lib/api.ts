import type {
  RouteResponse as RawRouteResponse,
  PathResult as RawPathResult,
  GraphEdgesResponse,
  MapDataResponse,
  ToggleResponse,
  UnblockAllResponse,
  LatLng,
  PathSegment,
} from '@/types';

const BASE = '';

type RawSegment = [number[], string | null, string, boolean, string | null];

interface RawPathResultNormalized {
  path: RawSegment[];
  distance_meters: number;
  estimate_time: number;
  waypoints?: { name: string; type: string }[];
}

interface RawRouteResponseNormalized {
  fastest: RawPathResultNormalized | null;
  shortest: RawPathResultNormalized | null;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { error?: string }).error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

function normalizePath(raw: RawPathResultNormalized | null): {
  path: PathSegment[];
  distanceMeters: number;
  estimateTime: number;
  waypoints: { name: string; type: string }[];
} | null {
  if (!raw || !raw.path) return null;
  return {
    path: raw.path.map((seg: RawSegment) => ({
      coord: [seg[0][0], seg[0][1]] as LatLng,
      name: seg[1],
      type: seg[2] as PathSegment['type'],
      isSubway: seg[3],
      wayName: seg[4],
    })),
    distanceMeters: raw.distance_meters,
    estimateTime: raw.estimate_time,
    waypoints: raw.waypoints || [],
  };
}

export async function pathfind(start: LatLng, end: LatLng) {
  const raw = await request<RawRouteResponseNormalized>('/api/v1/pathfind', {
    method: 'POST',
    body: JSON.stringify({ start, end }),
  });
  return {
    fastest: normalizePath(raw.fastest),
    shortest: normalizePath(raw.shortest),
  };
}

export function getMapData() {
  return request<MapDataResponse>('/api/v1/map-data');
}

export function getGraphEdges() {
  return request<GraphEdgesResponse>('/api/v1/graph-edges');
}

export function toggleNode(nodeId: number) {
  return request<ToggleResponse>('/api/v1/toggle-node', {
    method: 'POST',
    body: JSON.stringify({ node_id: nodeId }),
  });
}

export function unblockAll() {
  return request<UnblockAllResponse>('/api/v1/unblock-all', {
    method: 'POST',
  });
}
