/**
 * Typed REST API client for the Kyoto Transit backend.
 *
 * Every method increments/decrements the loading counter on the store,
 * and surfaces typed errors through ApiError.
 */

import { store } from "./state";
import type {
  RouteResult,
  RouteRequestBody,
  StopSummary,
  StopDetail,
  RouteSummary,
  RouteDetail,
  GraphData,
  MapData,
  HealthStatus,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: any,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const BASE = "";

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  store.startLoading();
  try {
    const res = await fetch(`${BASE}${url}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });

    if (!res.ok) {
      let body: any;
      try { body = await res.json(); } catch { /* no-op */ }
      throw new ApiError(
        body?.error || `Request failed: HTTP ${res.status}`,
        res.status,
        body,
      );
    }

    return (await res.json()) as T;
  } finally {
    store.stopLoading();
  }
}

// ── Health ────────────────────────────────────────────────────────

export function getHealth(): Promise<HealthStatus> {
  return request<HealthStatus>("/api/v2/health");
}

// ── Routing ───────────────────────────────────────────────────────

export function findRoute(body: RouteRequestBody): Promise<RouteResult> {
  return request<RouteResult>("/api/v2/route", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Stops ─────────────────────────────────────────────────────────

export interface SearchStopsParams {
  name?: string;
  type?: string;
  mode?: string;
  minLat?: number;
  minLon?: number;
  maxLat?: number;
  maxLon?: number;
  limit?: number;
}

export function searchStops(params: SearchStopsParams): Promise<{ count: number; stops: StopSummary[] }> {
  const qs = new URLSearchParams();
  if (params.name) qs.set("name", params.name);
  if (params.type) qs.set("type", params.type);
  if (params.mode) qs.set("mode", params.mode);
  if (params.minLat != null) qs.set("min_lat", String(params.minLat));
  if (params.maxLat != null) qs.set("max_lat", String(params.maxLat));
  if (params.minLon != null) qs.set("min_lon", String(params.minLon));
  if (params.maxLon != null) qs.set("max_lon", String(params.maxLon));
  if (params.limit) qs.set("limit", String(params.limit));

  const suffix = qs.toString() ? `?${qs}` : "";
  return request(`/api/v2/stops${suffix}`);
}

export function getStopDetail(stopId: number): Promise<StopDetail> {
  return request<StopDetail>(`/api/v2/stops/${stopId}`);
}

// ── Routes ────────────────────────────────────────────────────────

export function getRoutes(routeType?: string): Promise<{ count: number; routes: RouteSummary[] }> {
  const qs = routeType ? `?type=${encodeURIComponent(routeType)}` : "";
  return request(`/api/v2/routes${qs}`);
}

export function getRouteDetail(routeId: number): Promise<RouteDetail> {
  return request<RouteDetail>(`/api/v2/routes/${routeId}`);
}

// ── Graph ─────────────────────────────────────────────────────────

export function getGraphData(): Promise<GraphData> {
  return request<GraphData>("/api/v2/graph");
}

// ── Map Data (backward compat with v1) ────────────────────────────

export function getMapData(): Promise<MapData> {
  return request<MapData>("/api/v1/map-data");
}

// ── Admin ─────────────────────────────────────────────────────────

export function toggleBlockNode(nodeId: number): Promise<{ node_id: number; blocked: boolean }> {
  return request(`/api/v1/toggle-node`, {
    method: "POST",
    body: JSON.stringify({ node_id: nodeId }),
  });
}

export function blockStop(stopId: number, reason?: string): Promise<{ stop_id: number; action: string }> {
  return request(`/api/v2/admin/block`, {
    method: "POST",
    body: JSON.stringify({ stop_id: stopId, reason }),
  });
}

export function unblockAll(): Promise<{ unblocked_count: number }> {
  return request(`/api/v2/admin/unblock-all`, { method: "POST" });
}

// ── Legacy v1 pathfind (for backward compat) ─────────────────────

export function pathfindV1(start: [number, number], end: [number, number]): Promise<{
  path: [number, number, string | null, string][];
  distance_meters: number;
  estimate_time: number;
}> {
  return request("/api/v1/pathfind", {
    method: "POST",
    body: JSON.stringify({ start, end }),
  });
}