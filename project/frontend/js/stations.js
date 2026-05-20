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
 * Render các trạm và điểm dừng và cổng vào từ dữ liệu OSM.
 */
function renderStations(map, data, onMarkerClick) {
    for (const element of data.elements) {
        if (!element || element.type !== "node" || !element.tags) continue;

        const { railway } = element.tags;
        
        // Kiểm tra xem có phải station, stop, hoặc subway_entrance
        let markerType = null;
        if (railway === "station") {
            markerType = "station";
        } else if (railway === "stop") {
            markerType = "stop";
        } else if (railway === "subway_entrance") {
            markerType = "subway";
        } else {
            continue;
        }

        const { lat, lon } = element;
        const name = element.tags["name:en"] || 'Entrance_' + element.id;

        // Xác định màu sắc dựa trên loại
        let color, fillColor, radius;
        if (markerType === "station") {
            color = "blue";
            fillColor = "blue";
            radius = 8;
        } else if (markerType === "stop") {
            color = "red";
            fillColor = "red";
            radius = 6;
        } else if (markerType === "subway") {
            color = "purple";
            fillColor = "purple";
            radius = 7;
        }

        const marker = L.circleMarker([lat, lon], {
            radius: radius,
            color: "white",
            fillColor: fillColor,
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
