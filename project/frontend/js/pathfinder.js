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

/**
 * Khởi tạo pathfinder: gắn sự kiện click bản đồ và nút bấm.
 * @param {L.Map} map - Instance bản đồ Leaflet.
 */
export function initPathfinder(map) {
    const btnRoute = document.getElementById("btnRoute");
    const btnClear = document.getElementById("btnClear");
    distanceInfo = document.getElementById("distance-info");

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
        btnRoute.innerText = "Tìm đường";
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

// ──────────────── Internal ────────────────

function startSelecting(map, btnRoute) {
    // Xóa kết quả cũ
    clearMarkers(map);
    clearPolylines(map);
    hideDistance();
    points = [];

    isSelecting = true;
    btnRoute.innerText = "Chọn 2 điểm trên bản đồ";
    btnRoute.classList.add("active");
}

function cancelSelecting(btnRoute) {
    isSelecting = false;
    btnRoute.innerText = "Tìm đường";
    btnRoute.classList.remove("active");
}

function clearAll(map, btnRoute) {
    clearMarkers(map);
    clearPolylines(map);
    hideDistance();
    points = [];
    isSelecting = false;
    btnRoute.innerText = "Tìm đường";
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

    } catch (error) {
        console.error("Lỗi gửi dữ liệu đến server:", error);
        alert("Lỗi kết nối đến server. Hãy đảm bảo backend đang chạy.");
    }
}

/**
 * Vẽ đường đi trên bản đồ.
 */
function drawPath(map, path) {
    const pathLatLngs = [];

    for (const [coord, stopName] of path) {
        if (coord) {
            pathLatLngs.push(coord);
        }
        if (stopName && coord) {
            const marker = L.circleMarker(coord, {
                radius: 8,
                color: "white",
                fillColor: "red",
                fillOpacity: 1,
            }).addTo(map).bindPopup(`Trạm: ${stopName}`);
            markers.push(marker);
        }
    }

    if (pathLatLngs.length > 0) {
        const polyline = L.polyline(pathLatLngs, {
            color: "green",
            weight: 5,
        }).addTo(map).bindPopup("Đường đi ngắn nhất");
        polylines.push(polyline);
    }
}

/**
 * Hiển thị khoảng cách.
 */
function showDistance(meters) {
    if (!distanceInfo) return;
    const km = (meters / 1000).toFixed(2);
    distanceInfo.textContent = `Khoảng cách: ${km} km (${Math.round(meters)} m)`;
    distanceInfo.classList.add("visible");
}

function hideDistance() {
    if (!distanceInfo) return;
    distanceInfo.textContent = "";
    distanceInfo.classList.remove("visible");
}
