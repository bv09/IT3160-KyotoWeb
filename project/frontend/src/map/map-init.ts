/**
 * Leaflet map factory. Creates and configures the map instance.
 */

import L from "leaflet";
import {
  MAP_CENTER,
  MAP_ZOOM,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_TILE_URL,
  MAP_ATTRIBUTION,
} from "../config";

export function initMap(containerId: string = "map"): L.Map {
  const map = L.map(containerId, {
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    minZoom: MAP_MIN_ZOOM,
    maxZoom: MAP_MAX_ZOOM,
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer(MAP_TILE_URL, {
    maxZoom: MAP_MAX_ZOOM,
    attribution: MAP_ATTRIBUTION,
  }).addTo(map);

  // Custom panes for z-ordering
  map.createPane("graphPane");
  map.getPane("graphPane")!.style.zIndex = "200";
  map.getPane("graphPane")!.style.pointerEvents = "none";

  map.createPane("routePane");
  map.getPane("routePane")!.style.zIndex = "300";
  map.getPane("routePane")!.style.pointerEvents = "none";

  return map;
}