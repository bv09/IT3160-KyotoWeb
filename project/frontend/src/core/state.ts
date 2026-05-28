/**
 * Lightweight PubSub state store.
 * Inspired by FacilMap's event-driven architecture.
 */

type EventHandler = (data?: any) => void;

export class StateStore {
  private _listeners = new Map<string, Set<EventHandler>>();

  // ── App State ──────────────────────────────────────────────────

  role: "user" | "admin" = "user";
  stopMode = false;
  selectingMode = false;

  fromStop: { lat: number; lon: number; name: string; id: number } | null = null;
  toStop: { lat: number; lon: number; name: string; id: number } | null = null;

  routeResult: import("./types").RouteResult | null = null;
  routeError: string | null = null;

  private _loading = 0;

  // ── Admin State ────────────────────────────────────────────────

  graphVisible = false;
  graphData: import("./types").GraphData | null = null;
  blockedNodes = new Set<number>();

  // ── Map State ──────────────────────────────────────────────────

  mapData: import("./types").MapData | null = null;

  // ── Loading counter (FacilMap-inspired) ────────────────────────

  get loading(): boolean {
    return this._loading > 0;
  }

  startLoading(): void {
    this._loading++;
    if (this._loading === 1) this.emit("loading:changed", true);
  }

  stopLoading(): void {
    this._loading = Math.max(0, this._loading - 1);
    if (this._loading === 0) this.emit("loading:changed", false);
  }

  // ── Role ───────────────────────────────────────────────────────

  setRole(role: "user" | "admin"): void {
    this.role = role;
    this.stopMode = false;
    if (role === "user") {
      this.graphVisible = false;
    }
    this.emit("role:changed", role);
    this.emit("stopmode:changed", false);
  }

  // ── Stop Mode ──────────────────────────────────────────────────

  toggleStopMode(): void {
    this.stopMode = !this.stopMode;
    this.emit("stopmode:changed", this.stopMode);
  }

  // ── Route ──────────────────────────────────────────────────────

  setRouteResult(result: import("./types").RouteResult | null): void {
    this.routeResult = result;
    this.routeError = null;
    this.emit("route:result", result);
  }

  setRouteError(error: string): void {
    this.routeResult = null;
    this.routeError = error;
    this.emit("route:error", error);
  }

  setFromStop(stop: { lat: number; lon: number; name: string; id: number } | null): void {
    this.fromStop = stop;
    this.emit("fromstop:changed", stop);
  }

  setToStop(stop: { lat: number; lon: number; name: string; id: number } | null): void {
    this.toStop = stop;
    this.emit("tostop:changed", stop);
  }

  // ── Graph ──────────────────────────────────────────────────────

  setGraphData(data: import("./types").GraphData | null): void {
    this.graphData = data;
    this.emit("graph:changed", data);
  }

  setGraphVisible(visible: boolean): void {
    this.graphVisible = visible;
    this.emit("graphvisible:changed", visible);
  }

  setBlockedNodes(nodes: Set<number>): void {
    this.blockedNodes = nodes;
    this.emit("blockednodes:changed", nodes);
  }

  // ── Map Data ───────────────────────────────────────────────────

  setMapData(data: import("./types").MapData): void {
    this.mapData = data;
    this.emit("mapdata:loaded", data);
  }

  // ── PubSub ─────────────────────────────────────────────────────

  on(event: string, handler: EventHandler): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    this._listeners.get(event)?.delete(handler);
  }

  emit(event: string, data?: any): void {
    this._listeners.get(event)?.forEach((fn) => fn(data));
  }
}

/** Singleton store instance */
export const store = new StateStore();