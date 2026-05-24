
/**
 * Pathfinder — Quản lý logic chọn điểm, gọi API, vẽ đường.
 *
 * State machine:
 *   IDLE → (click "Tìm đường") → SELECTING → (chọn 2 điểm) → LOADING → IDLE
 */
import { API_BASE } from "./config.js";
 
// State
let isSelecting = false;
let points = [];
let markers = [];
let polylines = [];
let distanceInfo = null;
let timeInfo = null;
 
/**
 * Khởi tạo pathfinder: gắn sự kiện click bản đồ và nút bấm.
 * @param {L.Map} map - Instance bản đồ Leaflet.
 */
export function initPathfinder(map) {
    const btnRoute = document.getElementById("btnRoute");
    const btnClear = document.getElementById("btnClear");
    distanceInfo = document.getElementById("distance-info");
    timeInfo     = document.getElementById("time-info");
 
    // Click trên bản đồ (chọn điểm tùy ý)
    map.on("click", (e) => {
        if (!isSelecting) return;
        addPoint(map, e.latlng.lat, e.latlng.lng);
    });
 
    // Nút "Tìm đường"
    btnRoute.addEventListener("click", () => {
        if (!isSelecting) {
            startSelecting(map, btnRoute);
        } else {
            cancelSelecting(btnRoute);
        }
    });
 
    // Nút "Clear"
    btnClear.addEventListener("click", () => {
        clearAll(map, btnRoute);
    });
}
 
/**
 * Thêm một điểm được chọn (từ click trên bản đồ hoặc click marker).
 * Được export để stations.js có thể gọi khi click vào trạm.
 */
export function addPoint(map, lat, lon) {
    if (!isSelecting || points.length >= 2) return;
 
    points.push([lat, lon]);
    const marker = L.marker([lat, lon]).addTo(map);
    markers.push(marker);
 
    if (points.length === 2) {
        isSelecting = false;
        const btnRoute = document.getElementById("btnRoute");
        btnRoute.innerHTML = "<span>📍</span> Chọn điểm";
        btnRoute.classList.remove("active");
        sendToServer(map, points);
    }
}
 
/**
 * Kiểm tra có đang ở chế độ chọn điểm không.
 */
export function isInSelectingMode() {
    return isSelecting;
}
 
/**
 * Xóa toàn bộ đường + điểm đã vẽ (gọi khi chuyển sang Admin mode).
 */
export function clearPath(map) {
    clearMarkers(map);
    clearPolylines(map);
    hideDistance();
    hideTime();
    points      = [];
    isSelecting  = false;
    const btnRoute = document.getElementById("btnRoute");
    if (btnRoute) {
        btnRoute.innerHTML = "<span>📍</span> Chọn điểm";
        btnRoute.classList.remove("active");
    }
    const box = document.getElementById("result-box");
    if (box) box.classList.add("hidden");
}
 
// ──────────────── Internal ────────────────
 
function startSelecting(map, btnRoute) {
    clearMarkers(map);
    clearPolylines(map);
    hideDistance();
    hideTime();
    points = [];
 
    isSelecting = true;
    btnRoute.innerHTML = "<span>🗺</span> Chọn 2 điểm...";
    btnRoute.classList.add("active");
}
 
function cancelSelecting(btnRoute) {
    isSelecting = false;
    btnRoute.innerHTML = "<span>📍</span> Chọn điểm";
    btnRoute.classList.remove("active");
}
 
function clearAll(map, btnRoute) {
    clearMarkers(map);
    clearPolylines(map);
    hideDistance();
    hideTime();
    points = [];
    isSelecting = false;
    btnRoute.innerHTML = "<span>📍</span> Chọn điểm";
    btnRoute.classList.remove("active");
}
 
function clearMarkers(map) {
    markers.forEach((m) => map.removeLayer(m));
    markers = [];
}
 
function clearPolylines(map) {
    polylines.forEach((p) => map.removeLayer(p));
    polylines = [];
}
 
/**
 * Gửi 2 điểm đã chọn lên backend để tìm đường ngắn nhất.
 */
async function sendToServer(map, points) {
    try {
        const response = await fetch(`${API_BASE}/api/v1/pathfind`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                start: points[0],
                end: points[1],
            }),
        });
 
        if (response.status === 404) {
            alert("Không tìm thấy đường đi giữa 2 điểm đã chọn.");
            return;
        }
 
        if (response.status === 400) {
            const err = await response.json();
            alert("Lỗi: " + (err.error || "Dữ liệu không hợp lệ."));
            return;
        }
 
        if (!response.ok) {
            alert("Lỗi không xác định: " + response.status);
            return;
        }
 
        const data = await response.json();
        drawPath(map, data.path);
        showDistance(data.distance_meters);
        showTime(data.estimate_time);
    } catch (error) {
        console.error("Lỗi gửi dữ liệu đến server:", error);
        alert("Lỗi kết nối đến server. Hãy đảm bảo backend đang chạy.");
    }
}
 
/**
 * Vẽ đường đi trên bản đồ.
 * - Đường nét đứt cong (Manhattan): từ endpoint đến điểm bất kỳ, hoặc giữa stop/entrance
 * - Đường nét liền xanh: còn lại
 */
function drawPath(map, path) {
    // Vẽ markers cho các điểm
    for (const [coord, stopName, type] of path) {
        if (type == 'endpoint') continue;
        if (coord) {
            if (type == 'stop') {
            const marker = L.circleMarker(coord, {
                radius: 12,
                color: "white",
                fillColor: "green",
                fillOpacity: 1,
            }).addTo(map).bindPopup(`Trạm: ${stopName}`);
            markers.push(marker);
            }
            else if (type == 'entrance') {
                const marker = L.circleMarker(coord, {
                    radius: 8,
                    color: "white",
                    fillColor: "purple",
                    fillOpacity: 1,
                }).addTo(map).bindPopup({stopName});
                markers.push(marker);
            }
            else {
                const marker = L.circleMarker(coord, {
                    radius: 2,
                    color: "blue",
                    fillColor: "blue",
                    fillOpacity: 0.4,
                }).addTo(map).bindPopup('Điểm trung gian');
                markers.push(marker);
            }
        }
    }
 
    // Vẽ các cạnh của đường đi
    for (let i = 0; i < path.length - 1; i++) {
        const [coordA, stopNameA, typeA] = path[i];
        const [coordB, stopNameB, typeB] = path[i + 1];
 
        if (!coordA || !coordB) continue;
 
        // Kiểm tra xem có phải endpoint không
        const isEndpointA = typeA === "endpoint";
        const isEndpointB = typeB === "endpoint";
        
        // Kiểm tra xem có stopName (stop/entrance) không
        const hasNameA = !!stopNameA;
        const hasNameB = !!stopNameB;
 
        // Nếu một trong hai là endpoint, hoặc cả hai đều có stopName → nét đứt cong (Manhattan)
        if (isEndpointA || isEndpointB || (hasNameA && hasNameB)) {
            const [lat1, lng1] = coordA;
            const [lat2, lng2] = coordB;
            const Path = [
                [lat1, lng1],
                [lat2, lng2]
            ];
            const polyline = L.polyline(Path, {
                color: "#5b5a5a",
                weight: 3,
                dashArray: "5, 8",
                opacity: 1
            }).addTo(map);
            polylines.push(polyline);
        }
        // Còn lại → nét liền xanh
        else {
            const polyline = L.polyline([coordA, coordB], {
                color: "#0066cc",  // Màu xanh
                weight: 4,
                opacity: 0.8
            }).addTo(map);
            polylines.push(polyline);
        }
    }
}
 
/**
 * Hiển thị khoảng cách.
 */
function showDistance(meters) {
    if (!distanceInfo) return;
    const km = (meters / 1000).toFixed(2);
    distanceInfo.textContent = `${km} km (${Math.round(meters)} m)`;
    const box = document.getElementById("result-box");
    if (box) box.classList.remove("hidden");
}
 
function hideDistance() {
    if (!distanceInfo) return;
    distanceInfo.textContent = "—";
}
 
/**
 * Hiển thị thời gian ước tính.
 */
function showTime(minutes) {
    if (!timeInfo) return;
    if (minutes == null) { hideTime(); return; }
    const hours = Math.floor(minutes / 60);
    const mins  = Math.round(minutes % 60);
    let timeStr = "";
    if (hours > 0) timeStr += `${hours} giờ `;
    timeStr += `${mins} phút`;
    timeInfo.textContent = timeStr;
}
 
function hideTime() {
    if (!timeInfo) return;
    timeInfo.textContent = "—";
    const box = document.getElementById("result-box");
    if (box) box.classList.add("hidden");
}