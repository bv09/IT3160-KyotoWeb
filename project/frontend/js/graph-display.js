/**
 * Hiển thị tất cả các edges từ SubwayGraph
 */

let graphLayer = null;
let graphVisible = false;

export function initGraphDisplay(map) {
    const btnToggleGraph = document.getElementById("btnToggleGraph");

    btnToggleGraph.addEventListener("click", async () => {
        if (graphVisible) {
            hideGraph(map);
            btnToggleGraph.classList.remove("active");
        } else {
            await showGraph(map);
            btnToggleGraph.classList.add("active");
        }
    });
}

async function showGraph(map) {
    try {
        if (graphLayer) {
            map.removeLayer(graphLayer);
        }

        const response = await fetch("/api/v1/graph-edges");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        graphLayer = L.featureGroup();

        const edges = data.edges || [];
        const nodes = data.nodes || {};

        edges.forEach(edge => {
            const fromCoord = nodes[String(edge.from)];
            const toCoord   = nodes[String(edge.to)];
            if (!fromCoord || !toCoord) return;

            if (edge.from_name && edge.to_name) {
                // Vẽ Manhattan path cho edges có tên (station → station)
                drawManhattanPath(fromCoord, toCoord, graphLayer);  
            } else {
                // Vẽ thẳng cho edges thường
                L.polyline(
                    [[fromCoord[0], fromCoord[1]], [toCoord[0], toCoord[1]]],
                    { color: "#ff6f00", weight: 2, opacity: 0.6, interactive: false }
                ).addTo(graphLayer);  
            }
        });

        graphLayer.addTo(map);
        graphVisible = true;
    } catch (error) {
        console.error("Lỗi khi load graph edges:", error);
        alert(`Không thể tải graph: ${error.message}`);
    }
}

function hideGraph(map) {
    if (graphLayer) {
        map.removeLayer(graphLayer);
    }
    graphVisible = false;
}

function drawManhattanPath(pointA, pointB, layer) {
    const [lat1, lon1] = pointA;
    const [lat2, lon2] = pointB;
    const latMid = (lat1 + lat2) / 2;

    const points = [
        [lat1,   lon1],
        [latMid, lon1],
        [latMid, lon2],
        [lat2,   lon2],
    ];

    L.polyline(points, {
        color:     '#6b6a6a',
        weight:    3,
        dashArray: '6, 12',
        opacity:   0.9,
        interactive: false,
    }).addTo(layer); 
}