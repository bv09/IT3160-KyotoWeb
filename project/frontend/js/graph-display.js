/**
 * Hiển thị tất cả các edges từ SubwayGraph.
 */

let graphLayer   = null;
let graphVisible = false;

export function initGraphDisplay(map) {
    const btnToggleGraph = document.getElementById("btnToggleGraph");
    if (!btnToggleGraph) return;

    btnToggleGraph.addEventListener("click", async () => {
        if (graphVisible) {
            hideGraph(map);
            btnToggleGraph.innerHTML = "<span>🔗</span> Hiện Graph";
            btnToggleGraph.classList.remove("active");
        } else {
            const res  = await fetch("/api/v1/graph-edges");
            const data = await res.json();
            showGraphFromData(map, data);
            btnToggleGraph.innerHTML = "<span>🔗</span> Ẩn Graph";
            btnToggleGraph.classList.add("active");
        }
    });
}

/**
 * Vẽ graph từ dữ liệu đã fetch sẵn (không fetch lại).
 *
 * Logic mờ edges:
 *   Backend trả về `blocked_track_nodes`: tập các track node_id kề TRỰC TIẾP
 *   với các stop đang bị block. Edge bị mờ chỉ khi endpoint của nó nằm
 *   trong tập này → chỉ mờ đoạn đường sát trạm, không mờ cả tuyến.
 *
 * Tại sao không dùng way_id:
 *   1 way_id = cả tuyến subway → block 1 trạm sẽ mờ toàn bộ tuyến (quá rộng).
 *
 * Tại sao không dùng blocked_nodes trực tiếp:
 *   Stop nodes (railway=stop) không nằm trong subway way → không xuất hiện
 *   trong edges của graph → check sẽ luôn false.
 */
export function showGraphFromData(map, data) {
    const Pane = map.createPane("edge")
    Pane.style.zIndex = 200;
    Pane.style.pointerEvents = "none";
    if (graphLayer) map.removeLayer(graphLayer);
    graphLayer = L.featureGroup();

    const edges            = data.edges              || [];
    const nodes            = data.nodes              || {};
    const blockedTrackSet  = new Set(
        (data.blocked_track_nodes || []).map(String)
    );
    nodes/
    edges.forEach(edge => {
        const fromCoord = nodes[String(edge.from)];
        const toCoord   = nodes[String(edge.to)];
        if (!fromCoord || !toCoord) return;

        // Chỉ mờ edge nếu endpoint là track node kề trực tiếp với stop bị block
        const isBlocked = blockedTrackSet.size > 0 && (
            blockedTrackSet.has(String(edge.from)) ||
            blockedTrackSet.has(String(edge.to))
        );

        const opacity = isBlocked ? 0.5 : 0.7;
        const weight  = isBlocked ? 5    : 5;
        
        L.polyline(
            [[fromCoord[0], fromCoord[1]], [toCoord[0], toCoord[1]]],{   
                pane: "edge",
                color: isBlocked ? "#444": "blue", 
                weight, 
                opacity, 
                interactive: false }
        ).addTo(graphLayer);
    });

    graphLayer.addTo(map);
    graphVisible = true;
}

export function hideGraph(map) {
    if (graphLayer) map.removeLayer(graphLayer);
    graphVisible = false;
}

export function isGraphVisible() {
    return graphVisible;
}
