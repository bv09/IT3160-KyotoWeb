"""Đọc dữ liệu OSM và xây dựng SubwayGraph.

Trích xuất thông tin từ raw_osm_data.json (từ Overpass API)
để tạo đồ thị mạng lưới đường sắt Kyoto.
"""

import json
import logging
from pathlib import Path

from backend.models.graph import SubwayGraph
from backend.utils.geo import haversine_distance

logger = logging.getLogger(__name__)


def load_graph(filepath: str) -> SubwayGraph:
    """Đọc file OSM JSON và xây dựng đồ thị.

    Args:
        filepath: Đường dẫn tới file raw_osm_data.json.

    Returns:
        SubwayGraph đã được xây dựng từ dữ liệu OSM.

    Raises:
        FileNotFoundError: Khi file không tồn tại.
        ValueError: Khi file JSON không hợp lệ.
    """
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(
            f"Không tìm thấy file dữ liệu: '{filepath}'. "
            "Cần chạy 'make fetch-data' trước!"
        )

    logger.info("Đang đọc dữ liệu từ %s...", filepath)

    with open(path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    if "elements" not in raw_data:
        raise ValueError(
            f"File '{filepath}' không chứa trường 'elements'. "
            "Dữ liệu OSM không hợp lệ."
        )

    graph = _build_graph(raw_data)

    logger.info(
        "Xây dựng đồ thị thành công: %d nodes, %d edges.",
        graph.node_count,
        graph.edge_count,
    )

    return graph


def _build_graph(osm_data: dict) -> SubwayGraph:
    """Xây dựng đồ thị từ dữ liệu OSM đã parse.

    Xử lý 2 loại phần tử:
    1. node có railway=stop → đăng ký tên trạm/điểm dừng.
    2. way có nodes + geometry → tạo cạnh trong đồ thị.
    """
    graph = SubwayGraph()

    for element in osm_data.get("elements", []):
        # Đăng ký tên cho các điểm dừng (stop points)
        if (
            element.get("type") == "node"
            and "tags" in element
            and element["tags"].get("railway") == "stop"
        ):
            name = element["tags"].get(
                "name:en", element["tags"].get("name", f"Station_{element['id']}")
            )
            graph.register_stop(element["id"], element["lat"], element["lon"], name)

        # Xây dựng cạnh từ các đường (ways)
        if element.get("type") == "way" and "nodes" in element:
            _process_way(graph, element)

    return graph


def _process_way(graph: SubwayGraph, way: dict) -> None:
    """Xử lý một way element: tạo cạnh giữa các node liên tiếp."""
    nodes = way["nodes"]
    geometry = way.get("geometry", [])

    if len(geometry) < 2:
        return

    is_oneway = (
        way.get("tags") is not None and way["tags"].get("oneway") == "yes"
    )

    for i in range(len(nodes) - 1):
        if i + 1 >= len(geometry):
            break

        node1, node2 = nodes[i], nodes[i + 1]
        lat1, lon1 = geometry[i]["lat"], geometry[i]["lon"]
        lat2, lon2 = geometry[i + 1]["lat"], geometry[i + 1]["lon"]

        # Bỏ qua nếu tọa độ không hợp lệ
        if None in (lat1, lon1, lat2, lon2):
            logger.warning(
                "Tọa độ không hợp lệ trong way %d giữa node %d và %d. Bỏ qua.",
                way.get("id", "?"),
                node1,
                node2,
            )
            continue

        # Đăng ký ánh xạ node ↔ tọa độ
        graph.register_node_coord(node1, lat1, lon1)
        graph.register_node_coord(node2, lat2, lon2)

        # Tính khoảng cách và thêm cạnh
        distance = haversine_distance(lat1, lon1, lat2, lon2)

        if is_oneway:
            graph.add_edge(node1, node2, distance)
        else:
            graph.add_undirected_edge(node1, node2, distance)
