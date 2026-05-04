/**
 * Tải và hiển thị các trạm (stations) và điểm dừng (stops) trên bản đồ.
 * Hợp nhất logic từ cả index.html và map.html cũ.
 */
import { API_BASE } from "./config.js";

/**
 * Tải dữ liệu OSM và hiển thị các trạm/điểm dừng trên bản đồ.
 * @param {L.Map} map - Instance bản đồ Leaflet.
 * @param {function} onMarkerClick - Callback khi click vào marker (nhận {lat, lon}).
 */
export async function loadStations(map, onMarkerClick = null) {
    try {
        const response = await fetch(`${API_BASE}/api/v1/map-data`);
        if (!response.ok) {
            throw new Error(`Lỗi tải dữ liệu: HTTP ${response.status}`);
        }

        const data = await response.json();
        renderStations(map, data, onMarkerClick);

    } catch (error) {
        console.error("Lỗi tải dữ liệu bản đồ:", error);
        alert("Lỗi tải dữ liệu bản đồ. Hãy đảm bảo server backend đang chạy.");
    }
}

/**
 * Render các trạm và điểm dừng từ dữ liệu OSM.
 */
function renderStations(map, data, onMarkerClick) {
    for (const element of data.elements) {
        if (!element || element.type !== "node" || !element.tags) continue;

        const { railway } = element.tags;
        if (railway !== "station" && railway !== "stop") continue;

        const { lat, lon } = element;
        const name = element.tags["name:en"] || element.tags["name"] || "Unnamed";

        // Stations = xanh dương lớn, Stops = đỏ nhỏ
        const isStation = railway === "station";
        const marker = L.circleMarker([lat, lon], {
            radius: isStation ? 8 : 6,
            color: "white",
            fillColor: isStation ? "blue" : "red",
            fillOpacity: 1,
        }).addTo(map);

        marker.bindPopup(`<b>${name}</b><br>Lat: ${lat}, Lon: ${lon}`);

        // Cho phép click vào marker để chọn điểm (khi đang ở chế độ chọn)
        if (onMarkerClick) {
            marker.on("click", function (e) {
                L.DomEvent.stopPropagation(e);
                onMarkerClick({ lat, lon });
            });
        }
    }
}
