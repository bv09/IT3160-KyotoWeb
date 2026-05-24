/**
 * Tải và hiển thị các trạm (stations) trên bản đồ.
 *
 * TỐI ƯU: Cache dữ liệu OSM trong bộ nhớ sau lần đầu fetch,
 * các lần gọi sau chỉ re-render markers mà không fetch lại.
 */
import { API_BASE } from "./config.js";

let stationLayer = null;
let cachedOsmData = null;  // Cache OSM data — không đổi trong suốt session

/**
 * Tải (hoặc dùng cache) dữ liệu OSM và hiển thị trạm/điểm dừng trên bản đồ.
 *
 * @param {L.Map}       map           - Instance bản đồ Leaflet.
 * @param {function}    onMarkerClick - Callback khi click vào marker.
 * @param {Set<string>} blockedNodes  - Tập hợp node_id (string) đang bị chặn.
 */
export async function loadStations(map, onMarkerClick = null, blockedNodes = new Set()) {
    try {
        // Chỉ fetch 1 lần duy nhất trong toàn session
        if (!cachedOsmData) {
            const response = await fetch(`${API_BASE}/api/v1/map-data`);
            if (!response.ok) throw new Error(`Lỗi tải dữ liệu: HTTP ${response.status}`);
            cachedOsmData = await response.json();
        }

        if (stationLayer) map.removeLayer(stationLayer);
        stationLayer = L.featureGroup();

        renderStations(stationLayer, cachedOsmData, onMarkerClick, blockedNodes);
        stationLayer.addTo(map);
    } catch (error) {
        console.error("Lỗi tải dữ liệu bản đồ:", error);
        alert("Lỗi tải dữ liệu bản đồ. Hãy đảm bảo server backend đang chạy.");
    }
}

function renderStations(layer, data, onMarkerClick, blockedNodes) {
    for (const element of data.elements) {
        if (!element || element.type !== "node" || !element.tags) continue;
        if (element.tags.railway !== "stop") continue;

        const { lat, lon } = element;
        const name      = element.tags["name:en"] || "Stop_" + element.id;
        const isBlocked = blockedNodes.has(String(element.id));

        const marker = L.circleMarker([lat, lon], {
            radius:      8,
            color:       "white",
            fillColor:   isBlocked ? "#555" : "red",
            fillOpacity: isBlocked ? 0.5 : 1,
            opacity:     isBlocked ? 0.5 : 1,
        }).addTo(layer);

        const popupContent = isBlocked
            ? `<b>${name}</b><br><span style="color:#ef4444">⚠ Trạm đang tạm dừng</span>`
            : `<b>${name}</b><br><small>Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}</small>`;
        marker.bindPopup(popupContent);

        if (onMarkerClick) {
            marker.on("click", function (e) {
                L.DomEvent.stopPropagation(e);
                onMarkerClick({ lat, lon, node_id: element.id, name });
            });
        }
    }
}