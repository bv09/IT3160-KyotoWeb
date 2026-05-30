"""API routes — Blueprint chứa các endpoint cho ứng dụng."""

import json
import logging

from flask import Blueprint, current_app, jsonify, request

from backend.services.pathfinding import find_both_paths, find_shortest_path
from backend.utils.validation import ValidationError, validate_pathfind_input
from backend.utils.nearest_points import find_nearest_node
from backend.utils.convert_to_time import convert_walk_time, convert_subway_time
from backend.utils.geo import haversine_distance as _haversine_distance

logger = logging.getLogger(__name__)

api_bp = Blueprint("api", __name__)


# ──────────────────────── API v1 ────────────────────────


@api_bp.route("/api/v1/pathfind", methods=["POST"])
def pathfind():
    """Tìm đồng thời 2 đường: ngắn nhất (distance) và nhanh nhất (time).

    Request body:
        { "start": [lat, lon], "end": [lat, lon] }

    Response (200):
        {
            "shortest": {
                "path": [...],
                "distance_meters": float,
                "estimate_time": float
            },
            "fastest": {
                "path": [...],
                "distance_meters": float,
                "estimate_time": float
            }
        }

    Cả hai key luôn xuất hiện trong response. Nếu không có đường, giá trị
    tương ứng là null.
    """
    graph    = current_app.config["GRAPH"]
    tree     = current_app.config["KDTREE"]
    node_ids = current_app.config["NODE_IDS"]

    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Request body phải là JSON."}), 400

    try:
        start_coord, end_coord = validate_pathfind_input(data)
        if start_coord == end_coord:
            return jsonify({"error": "Điểm bắt đầu và kết thúc không được trùng nhau."}), 400
    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    # ── Snap điểm click về node gần nhất nếu cần ──
    dist_start = dist_end = 0.0
    old_start_coord = old_end_coord = None

    if graph.get_node_by_coord(start_coord[0], start_coord[1]) is None:
        nearest_node_start, dist_start = find_nearest_node(tree, node_ids, start_coord[0], start_coord[1])
        if dist_start == float("inf"):
            return jsonify({"error": "Không tìm thấy điểm nào gần điểm bắt đầu đã chọn."}), 404
        old_start_coord = start_coord
        start_coord = graph.get_coord_by_node(nearest_node_start)

    if graph.get_node_by_coord(end_coord[0], end_coord[1]) is None:
        nearest_node_end, dist_end = find_nearest_node(tree, node_ids, end_coord[0], end_coord[1])
        if dist_end == float("inf"):
            return jsonify({"error": "Không tìm thấy điểm nào gần điểm kết thúc đã chọn."}), 404
        old_end_coord = end_coord
        end_coord = graph.get_coord_by_node(nearest_node_end)

    bonus_distance = dist_start + dist_end
    bonus_time     = convert_walk_time(bonus_distance)
    same_node      = (start_coord == end_coord)

    # ── Chạy Dijkstra 2 lần ──
    both = find_both_paths(graph, start_coord, end_coord)

    if both.shortest is None and both.fastest is None:
        return jsonify({"error": "Không tìm thấy đường đi giữa 2 điểm đã chọn."}), 404

    def _serialize(result):
        """Chuyển PathResult → dict. waypoints chỉ gồm stop và endpoint."""
        if result is None:
            return None

        path = list(result.path)

        if same_node:
            path = []

        if old_start_coord is not None:
            path.insert(0, [old_start_coord, "A", "endpoint", False, None])
        if old_end_coord is not None:
            path.append([old_end_coord, "B", "endpoint", False, None])

        # Chỉ giữ lại các node là stop hoặc endpoint (bỏ entrance, node vô danh)
        waypoints = [
            {"name": name, "type": ntype}
            for (coord, name, ntype, is_subway, way_name) in path
            if ntype in ("stop", "endpoint") and name
        ]

        return {
            "path":            path,
            "distance_meters": round(result.distance_meters, 2) + bonus_distance,
            "estimate_time":   round(result.estimate_time,   2) + bonus_time,
            "waypoints":       waypoints,
        }

    return jsonify({
        "shortest": _serialize(both.shortest),
        "fastest":  _serialize(both.fastest),
    })


@api_bp.route("/api/v1/map-data", methods=["GET"])
def map_data():
    """Trả về dữ liệu OSM dùng để hiển thị bản đồ.

    TỐI ƯU: Dữ liệu được cache trong app.config["MAP_DATA"] lúc startup.
    """
    cached = current_app.config.get("MAP_DATA")
    if cached is not None:
        return jsonify(cached)

    data_file = current_app.config.get("DATA_FILE")
    if not data_file:
        return jsonify({"error": "DATA_FILE chưa được cấu hình."}), 500
    try:
        with open(data_file, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
        current_app.config["MAP_DATA"] = raw_data
        return jsonify(raw_data)
    except FileNotFoundError:
        return jsonify({"error": f"Không tìm thấy file '{data_file}'."}), 404


@api_bp.route("/api/v1/graph-edges", methods=["GET"])
def graph_edges():
    """Trả về edges + nodes (cached) và blocked_nodes (dynamic).

    Response (200):
        {
            "edges": [...],
            "nodes": { "123": [lat, lon], ... },
            "blocked_nodes": [node_id, ...],
            "blocked_track_nodes": [node_id, ...]
        }
    """
    graph = current_app.config.get("GRAPH")
    if not graph:
        return jsonify({"error": "Graph chưa được load."}), 500

    static = current_app.config.get("GRAPH_EDGES_STATIC")
    if static is None:
        static = _build_static_graph_data(graph)
        current_app.config["GRAPH_EDGES_STATIC"] = static

    blocked_nodes = [node_id for node_id, blocked in graph.blocked_node.items() if blocked]

    stop_neighbor_nodes = static.get("stop_neighbor_nodes", {})
    blocked_track_nodes = []
    seen = set()
    for node_id in blocked_nodes:
        for track_node in stop_neighbor_nodes.get(str(node_id), []):
            if track_node not in seen:
                blocked_track_nodes.append(track_node)
                seen.add(track_node)

    return jsonify({
        "edges":               static["edges"],
        "nodes":               static["nodes"],
        "node_ways":           static.get("node_ways", {}),
        "blocked_nodes":       blocked_nodes,
        "blocked_track_nodes": blocked_track_nodes,
    })


def _build_static_graph_data(graph) -> dict:
    """Xây dựng phần tĩnh của graph-edges (chỉ gọi 1 lần lúc startup / cache miss)."""
    edges = []
    nodes = {}
    node_ways = {}
    stop_neighbor_ways = {}

    for from_id, neighbors in graph.adjacency.items():
        for to_id, distance, time in neighbors:
            if graph.get_way_id(to_id) is not None and graph.get_way_id(from_id) is not None:
                if graph.get_stop_name(from_id) is None or graph.get_stop_name(to_id) is None:
                    edges.append({
                        "from":      from_id,
                        "to":        to_id,
                        "from_name": graph.get_stop_name(from_id) or graph.get_entrance_name(from_id),
                        "to_name":   graph.get_stop_name(to_id)   or graph.get_entrance_name(to_id),
                        "distance":  round(distance, 2),
                    })

    for node_id, coord in graph.node_map.items():
        way_ids = graph.get_way_id(node_id)
        if way_ids is not None and isinstance(coord, tuple):
            nodes[str(node_id)]     = list(coord)
            node_ways[str(node_id)] = way_ids

    # BFS: build stop → track segment nodes
    track_adj: dict[int, list[int]] = {}
    for edge in edges:
        f, t = edge["from"], edge["to"]
        track_adj.setdefault(f, []).append(t)
        track_adj.setdefault(t, []).append(f)

    all_stop_ids = {sid for sid in graph.stop_map if isinstance(sid, int)}
    stop_neighbor_nodes: dict[str, list[int]] = {}

    for stop_id in all_stop_ids:
        if stop_id not in track_adj:
            continue

        segment: set[int] = set()
        visited: set[int] = {stop_id}
        queue: list[int]  = [stop_id]
        stops_found = 0

        while queue:
            current = queue.pop(0)
            for neighbor in track_adj.get(current, []):
                if neighbor in visited:
                    continue
                visited.add(neighbor)
                if neighbor in all_stop_ids:
                    stops_found += 1
                    if stops_found >= 2:
                        queue.clear()
                        break
                else:
                    segment.add(neighbor)
                    queue.append(neighbor)

        if segment:
            stop_neighbor_nodes[str(stop_id)] = list(segment)

    return {
        "edges":               edges,
        "nodes":               nodes,
        "node_ways":           node_ways,
        "stop_neighbor_nodes": stop_neighbor_nodes,
    }


@api_bp.route("/api/v1/toggle-node", methods=["POST"])
def toggle_node():
    """Bật/tắt trạng thái bị chặn của một trạm (dành cho Admin)."""
    graph = current_app.config.get("GRAPH")
    if not graph:
        return jsonify({"error": "Graph chưa được load."}), 500

    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Request body phải là JSON."}), 400

    node_id = data.get("node_id")
    if node_id is None:
        return jsonify({"error": "Thiếu node_id."}), 400

    is_blocked = graph.blocked_node.get(node_id, False)
    graph.blocked_node[node_id] = not is_blocked

    return jsonify({"node_id": node_id, "blocked": graph.blocked_node[node_id]})


@api_bp.route("/api/v1/unblock-all", methods=["POST"])
def unblock_all():
    """Khôi phục tất cả trạm đang bị chặn (1 request thay vì N request).

    Response (200): { "unblocked_count": N }
    """
    graph = current_app.config.get("GRAPH")
    if not graph:
        return jsonify({"error": "Graph chưa được load."}), 500

    count = 0
    for node_id in list(graph.blocked_node.keys()):
        if graph.blocked_node[node_id]:
            graph.blocked_node[node_id] = False
            count += 1

    return jsonify({"unblocked_count": count})


# ──────────────── Legacy aliases ────────────────

@api_bp.route("/save_input", methods=["POST"])
def legacy_save_input():
    """Legacy endpoint — chuyển tiếp đến /api/v1/pathfind."""
    data = request.get_json(silent=True)
    if data is None:
        return "Request body phải là JSON.", 400
    try:
        start_coord, end_coord = validate_pathfind_input(data)
    except ValidationError as e:
        return e.message, 400

    graph  = current_app.config["GRAPH"]
    result = find_shortest_path(graph, start_coord, end_coord)

    if result is None:
        return "No path found", 404
    return jsonify(result.path)


@api_bp.route("/raw_osm_data.json", methods=["GET"])
def legacy_raw_osm_data():
    """Legacy endpoint — chuyển tiếp đến /api/v1/map-data."""
    return map_data()
