/**
 * Station layer — renders transit stops and entrances on the map.
 * Replaces project/frontend/js/stations.js.
 */

import L from "leaflet";
import { store } from "../../core/state";
import { getMapData } from "../../core/api-client";
import { createStationIcon } from "../utils";
import type { MapData, StationData } from "../../core/types";

let stationLayer: L.FeatureGroup | null = null;
let stationDataCache: StationData[] | null = null;
let labelsVisible = false;

/**
 * Load station data from the backend (or from cache) and render markers.
 */
export async function loadStationLayer(map: L.Map): Promise<void> {
  if (!stationDataCache) {
    const data: MapData = await getMapData();
    stationDataCache = parseStations(data);
    store.setMapData(data);
  }

  if (stationLayer) {
    map.removeLayer(stationLayer);
  }

  stationLayer = L.featureGroup();

  const blockedNodes = store.blockedNodes;
  for (const s of stationDataCache) {
    const isBlocked = blockedNodes.has(s.id);
    const station: StationData = { ...s, isBlocked };
    const icon = createStationIcon(station, false);
    const marker = L.marker([station.lat, station.lon], {
      icon,
      interactive: true,
      bubblingMouseEvents: false,
    });

    const popupContent = isBlocked
      ? `<b>${station.name}</b><br><span style="color:#ef4444">&#9888; Blocked</span>`
      : `<b>${station.name}</b><br><small>${station.lat.toFixed(5)}, ${station.lon.toFixed(5)}</small>`;

    marker.bindPopup(popupContent);

    marker.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      store.emit("station:click", {
        lat: station.lat,
        lon: station.lon,
        node_id: station.id,
        name: station.name,
      });
    });

    marker.addTo(stationLayer);
  }

  stationLayer.addTo(map);

  // Zoom-based label visibility
  map.on("zoomend", () => {
    const zoom = map.getZoom();
    const show = zoom >= 15;
    if (show !== labelsVisible) {
      labelsVisible = show;
      store.emit("labels:toggle", show);
    }
  });
}

/** Re-render station markers with updated blocked status */
export function updateStationBlockedStatus(map: L.Map): void {
  if (!stationLayer || !stationDataCache || !map.hasLayer(stationLayer)) return;

  map.removeLayer(stationLayer);
  stationLayer = L.featureGroup();

  const blockedNodes = store.blockedNodes;
  for (const s of stationDataCache) {
    const isBlocked = blockedNodes.has(s.id);
    const station: StationData = { ...s, isBlocked };
    const icon = createStationIcon(station, false);
    const marker = L.marker([station.lat, station.lon], {
      icon,
      interactive: true,
      bubblingMouseEvents: false,
    });

    const popupContent = isBlocked
      ? `<b>${station.name}</b><br><span style="color:#ef4444">&#9888; Blocked</span>`
      : `<b>${station.name}</b>`;

    marker.bindPopup(popupContent);

    marker.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      store.emit("station:click", {
        lat: station.lat,
        lon: station.lon,
        node_id: station.id,
        name: station.name,
      });
    });

    marker.addTo(stationLayer);
  }

  stationLayer.addTo(map);
}

function parseStations(data: MapData): StationData[] {
  const stations: StationData[] = [];
  for (const el of data.elements) {
    if (!el || el.type !== "node" || !el.tags) continue;
    if (el.tags.railway !== "stop" && el.tags.railway !== "subway_entrance") continue;

    stations.push({
      id: el.id,
      lat: el.lat,
      lon: el.lon,
      name: el.tags["name:en"] || el.tags.name || `Stop_${el.id}`,
      type: el.tags.railway === "subway_entrance" ? "entrance" : "stop_position",
      isBlocked: false,
    });
  }
  return stations;
}