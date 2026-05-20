"""API routes — Blueprint chứa các endpoint cho ứng dụng."""

import json
import logging

from flask import Blueprint, current_app, jsonify, request

from backend.services.pathfinding import find_shortest_path
from backend.utils.validation import ValidationError, validate_pathfind_input
from backend.utils.nearest_points import find_nearest_node

logger = logging.getLogger(__name__)

api_bp = Blueprint("api", __name__)


# ──────────────────────── API v1 ────────────────────────


@api_bp.route("/api/v1/pathfind", methods=["POST"])
def pathfind():
    """Tìm đường đi ngắn nhất giữa 2 tọa độ.

    Request body:
        { "start": [lat, lon], "end": [lat, lon] }

    Response (200):
        { "path": [[[lat, lon], stop_name], ...], "distance_meters": 1234.5 }

    Response (400): Dữ liệu không hợp lệ.
    Response (404): Không tìm thấy đường đi.
    """
    graph = current_app.config["GRAPH"]
    data = request.get_json(silent=True)
    tree = current_app.config["KDTREE"]
    node_ids = current_app.config["NODE_IDS"]

    if data is None:
        return jsonify({"error": "Request body phải là JSON."}), 400
    try:
        start_coord, end_coord = validate_pathfind_input(data)
        if start_coord == end_coord:
            return jsonify({"error": "Điểm bắt đầu và kết thúc không được trùng nhau."}), 400
    except ValidationError as e:
        return jsonify({"error": e.message}), 400
    
    #TEST
    logger.info("%s", json.dumps({"start": start_coord, "end": end_coord}, indent=2))

    dist_start = dist_end = 0.0
    old_start_coord = old_end_coord = None
    
    if graph.get_node_by_coord(start_coord[0], start_coord[1]) is None:
        nearest_node_start, dist_start = find_nearest_node(tree, node_ids, start_coord[0], start_coord[1])
        if dist_start == float('inf'):  
            return jsonify({"error": "Không tìm thấy điểm nào gần điểm bắt đầu đã chọn."}), 404
        old_start_coord = start_coord
        start_coord = graph.get_coord_by_node(nearest_node_start)
        
    if graph.get_node_by_coord(end_coord[0], end_coord[1]) is None:
        nearest_node_end, dist_end = find_nearest_node(tree, node_ids, end_coord[0], end_coord[1])
        if dist_end == float('inf'):
            return jsonify({"error": "Không tìm thấy điểm nào gần điểm kết thúc đã chọn."}), 404
        old_end_coord = end_coord
        end_coord = graph.get_coord_by_node(nearest_node_end)

    result = find_shortest_path(graph, start_coord, end_coord, dist_start + dist_end);
    
    if result is None:
        return jsonify({"error": "Không tìm thấy đường đi giữa 2 điểm đã chọn."}), 404
    if old_start_coord is not None: 
        result.path.insert(0, [old_start_coord, "A", "endpoint"])
    if old_end_coord is not None:
        result.path.append([old_end_coord, "B", "endpoint"])

    return jsonify({
        "path": result.path,
        "distance_meters": round(result.distance_meters, 2),
    })


@api_bp.route("/api/v1/map-data", methods=["GET"])
def map_data():
    """Trả về dữ liệu OSM dùng để hiển thị bản đồ."""
    data_file = current_app.config.get("DATA_FILE")
    if not data_file:
        return jsonify({"error": "DATA_FILE chưa được cấu hình."}), 500

    try:
        with open(data_file, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
        return jsonify(raw_data)
    except FileNotFoundError:
        return (
            jsonify({"error": f"Không tìm thấy file '{data_file}'. Cần chạy 'make fetch-data' trước!"}),
            404,
        )


@api_bp.route("/api/v1/graph-edges", methods=["GET"])
def graph_edges():
    """Trả về tất cả các edges từ SubwayGraph.

    Response (200):
        {
            "edges": [
                {"from": 123, "to": 456, "distance": 100.5, from_name": "Station A", "to_name": "Station B"},
                ...
            ],
            "nodes": {
                "123": [lat, lon],
                "456": [lat, lon],
                ...
            }
        }

    Response (500): Graph chưa được load.
    """
    graph = current_app.config.get("GRAPH")
    
    if not graph:
        return jsonify({"error": "Graph chưa được load."}), 500

    edges = []
    nodes = {}

    # Lấy tất cả edges từ adjacency list
    for from_id, neighbors in graph.adjacency.items():
        for to_id, distance in neighbors:
            edges.append({
                "from": from_id,
                "to": to_id,
                "from_name": graph.get_stop_name(from_id) or graph.get_entrance_name(from_id),
                "to_name": graph.get_stop_name(to_id) or graph.get_entrance_name(to_id),
                "distance": round(distance, 2)
            })

    # Lấy tọa độ của tất cả nodes
    for node_id, coord in graph.node_map.items():
        if isinstance(coord, tuple):  # coord có dạng (lat, lon)
            nodes[str(node_id)] = list(coord)

    return jsonify({
        "edges": edges,
        "nodes": nodes
    })



# ──────────────── Legacy aliases (tương thích ngược) ────────────────


@api_bp.route("/save_input", methods=["POST"])
def legacy_save_input():
    """Legacy endpoint — chuyển tiếp đến /api/v1/pathfind.

    Giữ lại để frontend cũ vẫn hoạt động trong quá trình chuyển đổi.
    Response format giữ nguyên dạng cũ: list of [[lat, lon], stop_name].
    """
    data = request.get_json(silent=True)
    if data is None:
        return "Request body phải là JSON.", 400

    try:
        start_coord, end_coord = validate_pathfind_input(data)
    except ValidationError as e:
        return e.message, 400

    graph = current_app.config["GRAPH"]
    result = find_shortest_path(graph, start_coord, end_coord)

    if result is None:
        return "No path found", 404

    # Format cũ: list of [[lat, lon], stop_name]
    return jsonify(result.path)


@api_bp.route("/raw_osm_data.json", methods=["GET"])
def legacy_raw_osm_data():
    """Legacy endpoint — chuyển tiếp đến /api/v1/map-data."""
    return map_data()
