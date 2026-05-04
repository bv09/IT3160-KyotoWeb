/**
 * Khởi tạo bản đồ Leaflet.
 */
import { MAP_CENTER, MAP_ZOOM, MAP_MAX_ZOOM, MAP_TILE_URL, MAP_ATTRIBUTION } from "./config.js";

/**
 * Tạo và trả về instance bản đồ Leaflet.
 * @param {string} containerId - ID của div chứa bản đồ.
 * @returns {L.Map} Instance bản đồ.
 */
export function initMap(containerId = "map") {
    const map = L.map(containerId).setView(MAP_CENTER, MAP_ZOOM);

    L.tileLayer(MAP_TILE_URL, {
        maxZoom: MAP_MAX_ZOOM,
        attribution: MAP_ATTRIBUTION,
    }).addTo(map);

    return map;
}
