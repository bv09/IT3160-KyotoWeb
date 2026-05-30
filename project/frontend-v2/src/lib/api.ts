import type {
  RouteResponse,
  GraphEdgesResponse,
  MapDataResponse,
  ToggleResponse,
  UnblockAllResponse,
  LatLng,
} from '@/types';

const BASE = '';

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

export function pathfind(start: LatLng, end: LatLng) {
  return request<RouteResponse>('/api/v1/pathfind', {
    method: 'POST',
    body: JSON.stringify({ start, end }),
  });
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
