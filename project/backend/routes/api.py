"""API routes — Blueprint chứa các endpoint cho ứng dụng."""

import json
import logging

from flask import Blueprint, current_app, jsonify, request

from backend.services.pathfinding import find_shortest_path
from backend.utils.validation import ValidationError, validate_pathfind_input

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
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Request body phải là JSON."}), 400

    try:
        start_coord, end_coord = validate_pathfind_input(data)
    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    graph = current_app.config["GRAPH"]
    result = find_shortest_path(graph, start_coord, end_coord)

    if result is None:
        return jsonify({"error": "Không tìm thấy đường đi giữa 2 điểm đã chọn."}), 404

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
