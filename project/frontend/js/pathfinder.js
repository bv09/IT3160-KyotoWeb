/**
 * Pathfinder — Quản lý logic chọn điểm, gọi API, vẽ đường.
 *
 * State machine:
 *   IDLE → (click "Chọn điểm") → SELECTING → (chọn 2 điểm) → LOADING → IDLE
 *
 * Sau khi có kết quả, người dùng có thể chuyển giữa "shortest" và "fastest"
 * mà không cần gọi API lại — dữ liệu cả hai đường được lưu trong lastData.
 */
import { API_BASE } from "./config.js";

// ── State ──
let isSelecting   = false;
let points        = [];
let markers       = [];
let polylines     = [];
let distanceInfo  = null;
let timeInfo      = null;
let currentMode   = "fastest";   // "fastest" | "shortest"
let lastData      = null;         // cache response { fastest: {...}, shortest: {...} }

/**
 * Khởi tạo pathfinder: gắn sự kiện click bản đồ và các nút bấm.
 * @param {L.Map} map - Instance bản đồ Leaflet.
 */
export function initPathfinder(map) {
    const btnRoute    = document.getElementById("btnRoute");
    const btnClear    = document.getElementById("btnClear");
    const btnFastest  = document.getElementById("btnModeFastest");
    const btnShortest = document.getElementById("btnModeShortest");
    distanceInfo = document.getElementById("distance-info");
    timeInfo     = document.getElementById("time-info");

    // Click trên bản đồ
    map.on("click", (e) => {
        if (!isSelecting) return;
        addPoint(map, e.latlng.lat, e.latlng.lng);
    });

    // Nút "Chọn điểm"
    btnRoute.addEventListener("click", () => {
        if (!isSelecting) {
            startSelecting(map, btnRoute);
        } else {
            cancelSelecting(btnRoute);
        }
    });

    // Nút "Xóa"
    btnClear.addEventListener("click", () => {
        clearAll(map, btnRoute);
    });

    // Toggle chế độ đường
    btnFastest.addEventListener("click",  () => setMode(map, "fastest"));
    btnShortest.addEventListener("click", () => setMode(map, "shortest"));
}

/**
 * Thêm một điểm được chọn (từ click bản đồ hoặc click marker trạm).
 * Export để stations.js có thể gọi.
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

/** Kiểm tra có đang ở chế độ chọn điểm không. */
export function isInSelectingMode() {
    return isSelecting;
}

/** Xóa toàn bộ đường + điểm đã vẽ (gọi khi chuyển sang Admin mode). */
export function clearPath(map) {
    clearMarkers(map);
    clearPolylines(map);
    hideResults();
    points      = [];
    lastData    = null;
    isSelecting = false;
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
    hideResults();
    points   = [];
    lastData = null;

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
    hideResults();
    points      = [];
    lastData    = null;
    isSelecting = false;
    btnRoute.innerHTML = "<span>📍</span> Chọn điểm";
    btnRoute.classList.remove("active");
    const box = document.getElementById("result-box");
    if (box) box.classList.add("hidden");
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
 * Đổi chế độ hiển thị (fastest / shortest).
 * Nếu đã có dữ liệu, vẽ lại ngay — không gọi API.
 */
function setMode(map, mode) {
    if (currentMode === mode) return;
    currentMode = mode;

    // Cập nhật trạng thái nút
    const btnFastest  = document.getElementById("btnModeFastest");
    const btnShortest = document.getElementById("btnModeShortest");
    if (btnFastest && btnShortest) {
        btnFastest.classList.toggle("active",  mode === "fastest");
        btnShortest.classList.toggle("active", mode === "shortest");
    }

    // Nếu đã có kết quả thì vẽ lại ngay
    if (lastData) {
        const result = lastData[currentMode];
        clearPolylines(map);
        // Xóa markers path cũ (giữ lại 2 marker điểm A/B đầu tiên)
        const pinMarkers = markers.splice(0, 2);
        markers.forEach((m) => map.removeLayer(m));
        markers = pinMarkers;

        if (result) {
            drawPath(map, result.path);
            showResults(result.distance_meters, result.estimate_time, result.waypoints);
        } else {
            hideResults();
        }
    }
}

/**
 * Gửi 2 điểm lên backend, nhận về cả 2 đường, vẽ theo chế độ hiện tại.
 */
async function sendToServer(map, pts) {
    try {
        const response = await fetch(`${API_BASE}/api/v1/pathfind`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ start: pts[0], end: pts[1] }),
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
        lastData = data;  // cache để toggle không cần fetch lại

        const result = data[currentMode];
        if (!result) {
            alert("Không tìm thấy đường đi cho chế độ đã chọn.");
            return;
        }

        drawPath(map, result.path);
        showResults(result.distance_meters, result.estimate_time, data[currentMode].waypoints);

    } catch (error) {
        console.error("Lỗi gửi dữ liệu đến server:", error);
        alert("Lỗi kết nối đến server. Hãy đảm bảo backend đang chạy.");
    }
}

/**
 * Vẽ đường đi trên bản đồ.
 * - Nét đứt xám : endpoint → node mạng, hoặc stop ↔ stop/entrance (đi bộ)
 * - Nét liền xanh dương : đoạn subway track
 * - Nét đứt cam  : đoạn đi bộ (highway)
 */
function drawPath(map, path) {
    for (const node of path) {
        const [coord, stopName, type] = node;
        if (type === "endpoint") continue;
        if (!coord) continue;

        if (type === "stop") {
            const m = L.circleMarker(coord, {
                radius: 12, color: "white", fillColor: "green", fillOpacity: 1,
            }).addTo(map).bindPopup(`Trạm: ${stopName}`);
            markers.push(m);
        } else if (type === "entrance") {
            const m = L.circleMarker(coord, {
                radius: 8, color: "white", fillColor: "purple", fillOpacity: 1,
            }).addTo(map).bindPopup(`${stopName}`);
            markers.push(m);
        }
    }

    for (let i = 0; i < path.length - 1; i++) {
        const [coordA, stopNameA, typeA, isSubwayA] = path[i];
        const [coordB, stopNameB, typeB, isSubwayB] = path[i + 1];

        if (!coordA || !coordB) continue;

        const isEndpoint = typeA === "endpoint" || typeB === "endpoint";
        const bothNamed  = !!stopNameA && !!stopNameB;

        if (isEndpoint) {
            // Nét đứt xám — snap tới mạng
            const pl = L.polyline([coordA, coordB], {
                color: "#5b5a5a", weight: 3, dashArray: "5, 8", opacity: 1,
            }).addTo(map);
            polylines.push(pl);
        } else if (bothNamed) {
            // Kết nối giữa 2 trạm/entrance — đi bộ
            const pl = L.polyline([coordA, coordB], {
                color: "#e07b00", weight: 3, dashArray: "6, 6", opacity: 0.9,
            }).addTo(map);
            polylines.push(pl);
        } else if (isSubwayA && isSubwayB) {
            // Đường ray subway — xanh dương đậm
            const pl = L.polyline([coordA, coordB], {
                color: "#0055cc", weight: 4, opacity: 0.9,
            }).addTo(map);
            polylines.push(pl);
        } else {
            // Đường bộ / highway — cam đứt
            const pl = L.polyline([coordA, coordB], {
                color: "#e07b00", weight: 3, dashArray: "6, 6", opacity: 0.9,
            }).addTo(map);
            polylines.push(pl);
        }
    }
}

// ── Helpers hiển thị kết quả ──

function showResults(meters, minutes, waypoints) {
    const box = document.getElementById("result-box");

    // Khoảng cách
    if (distanceInfo) {
        const km = (meters / 1000).toFixed(2);
        distanceInfo.textContent = `${km} km (${Math.round(meters)} m)`;
    }

    // Thời gian
    if (timeInfo) {
        if (minutes == null) {
            timeInfo.textContent = "—";
        } else {
            const hours = Math.floor(minutes / 60);
            const mins  = Math.round(minutes % 60);
            let timeStr = "";
            if (hours > 0) timeStr += `${hours} giờ `;
            timeStr += `${mins} phút`;
            timeInfo.textContent = timeStr;
        }
    }

    // Label tiêu đề kết quả theo chế độ
    const titleEl = document.getElementById("result-mode-label");
    if (titleEl) {
        titleEl.textContent = currentMode === "fastest"
            ? "⚡ Đường đi nhanh nhất"
            : "📏 Đường đi ngắn nhất";
    }

    // ── Waypoints ──
    const segEl = document.getElementById("segments-list");
    if (segEl && waypoints && waypoints.length > 0) {
        segEl.innerHTML = waypoints.map((wp, i) => {
            const isFirst = i === 0;
            const isLast  = i === waypoints.length - 1;
            const icon    = wp.type === "endpoint"
                ? (isFirst ? "📍" : "🏁")
                : "🚉";
            return `<li class="seg-item ${wp.type === "stop" ? "seg-subway" : "seg-walk"}">
                <span class="seg-icon">${icon}</span>
                <span class="seg-mode">${wp.name}</span>
            </li>`;
        }).join("");
        document.getElementById("segments-box").classList.remove("hidden");
    } else if (segEl) {
        segEl.innerHTML = "";
        document.getElementById("segments-box").classList.add("hidden");
    }

    if (box) box.classList.remove("hidden");
}

function hideResults() {
    if (distanceInfo) distanceInfo.textContent = "—";
    if (timeInfo)     timeInfo.textContent     = "—";
    const segBox = document.getElementById("segments-box");
    if (segBox) segBox.classList.add("hidden");
}
