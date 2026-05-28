/**
 * Graph visualization layer — renders transit graph edges for admin mode.
 * Refactored from project/frontend/js/graph-display.js.
 */

import L from "leaflet";
import { store } from "../../core/state";
import { getGraphData } from "../../core/api-client";
import type { GraphData, LatLng } from "../../core/types";

let graphLayer: L.FeatureGroup | null = null;

/** Fetch graph data and render on map */
export async function showGraph(map: L.Map): Promise<void> {
  const data: GraphData = await getGraphData();
  store.setGraphData(data);
  renderGraph(map, data);
  store.setGraphVisible(true);
}

/** Render graph edges from data */
export function renderGraph(map: L.Map, data: GraphData): void {
  hideGraph(map);

  graphLayer = L.featureGroup();

  const nodes: Record<string, LatLng> = data.nodes;
  const blockedTrackSet = new Set((data.blocked_track_nodes || []).map(String));

  for (const edge of data.edges) {
    const fromCoord = nodes[String(edge.from)];
    const toCoord = nodes[String(edge.to)];
    if (!fromCoord || !toCoord) continue;

    const isBlocked =
      blockedTrackSet.size > 0 &&
      (blockedTrackSet.has(String(edge.from)) ||
        blockedTrackSet.has(String(edge.to)));

    const opacity = isBlocked ? 0.3 : 0.7;
    const weight = isBlocked ? 3 : 4;

    let color: string;
    if (isBlocked) {
      color = "#444";
    } else if (edge.edge_type === "subway") {
      color = "#3b82f6";
    } else if (edge.edge_type === "walk" || edge.edge_type === "entrance") {
      color = "#94a3b8";
    } else {
      color = "#6b7280";
    }

    L.polyline([fromCoord, toCoord], {
      pane: "graphPane",
      color,
      weight,
      opacity,
      interactive: false,
    }).addTo(graphLayer);
  }

  graphLayer.addTo(map);
}

/** Hide the graph layer */
export function hideGraph(map: L.Map): void {
  if (graphLayer) {
    map.removeLayer(graphLayer);
    graphLayer = null;
  }
  store.setGraphVisible(false);
}

/** Check if graph layer is currently visible */
export function isGraphVisible(): boolean {
  return store.graphVisible;
}