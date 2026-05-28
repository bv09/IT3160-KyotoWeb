"""Đọc dữ liệu OSM và xây dựng SubwayGraph.

Trích xuất thông tin từ raw_osm_data.json (từ Overpass API)
để tạo đồ thị mạng lưới đường sắt Kyoto.
"""

import json
import logging
from pathlib import Path

from backend.models.graph import SubwayGraph
from backend.utils.geo import haversine_distance
from backend.utils.geo import manhattan_distance
from backend.utils.convert_to_time import convert_walk_time, convert_subway_time

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

    Xử lý các loại phần tử:
    1. node có railway=stop → đăng ký tên trạm/điểm dừng.
    2. way có nodes + geometry → tạo cạnh trong đồ thị.
    3. node có railway=subway_entrance → đăng ký tên entrance và tạo node trong đồ thị.
    4. relation có public_transport=stop_area → kết nối stop với entrance trong cùng 1 relation, và kết nối giữa các stop trong cùng 1 relation.
    5. đăng kí way_map và blocked_node.
    """
    graph = SubwayGraph()
    isInRelation : dict[int, bool] = {}
    stops_in_relation : list[int] = [];
    
    
    # Đăng ký nodes và xây dựng cạnh từ các ways
    for element in osm_data.get("elements", []):
        # Đăng ký tên cho các điểm dừng (stop points) và subway_entrance
        if (
            element.get("type") == "node"
            and "tags" in element
            and element["tags"].get("railway") == "stop"
        ):
            name = element["tags"].get(
                "name:en", element["tags"].get("name", f"Station_{element['id']}")
            )
            graph.register_stop(element["id"], element["lat"], element["lon"], name)
        elif (
            element.get("type") == "node"
            and "tags" in element
            and element["tags"].get("railway") == "subway_entrance"
        ):
            name = f"Entrance_{element['id']}"
            graph.register_entrance(element["id"], element["lat"], element["lon"], name)
            graph.register_node_coord(element["id"], element["lat"], element["lon"])
            
        # Xây dựng cạnh từ các đường (ways)
        if element.get("type") == "way" and "nodes" in element:
            _process_way(graph, element)
            
            
    # Thêm cạnh nối giữa các entrances và stops trong cùng 1 relation stop_area 
    for element in osm_data.get("elements", []):     
        if element.get("type") == "relation" and "tags" in element and element["tags"].get("public_transport") == "stop_area":
            members = element.get("members", [])
            stop_nodes = [m for m in members if graph.get_stop_name(m.get("ref", -1)) is not None]
            if (len(stop_nodes) != 2):
                logger.warning(
                    "Relation %d có %d stop nodes (cần 2). lỗi!",
                    element.get("id", "?"),
                    len(stop_nodes),
                )
                continue
            stops_in_relation.extend([stop["ref"] for stop in stop_nodes])
            entrance_nodes = [m for m in members if graph.get_entrance_name(m.get("ref", -1)) is not None]
            
            # Kết nối stop với entrance
            for stop in stop_nodes:
                for entrance in entrance_nodes:
                    isInRelation[entrance["ref"]] = True
                    if (entrance.get("lat") is None or entrance.get("lon") is None or stop.get("lat") is None or stop.get("lon") is None):
                        logger.warning(
                            "Tọa độ không hợp lệ trong relation %d giữa stop %d và entrance %d. Bỏ qua.",
                            element.get("id", "?"),
                            stop["ref"],
                            entrance["ref"],
                        )
                        continue
                    distance = manhattan_distance(stop["lat"], stop["lon"], entrance["lat"], entrance["lon"])
                    graph.add_undirected_edge(stop["ref"], entrance["ref"], distance * 1.1, convert_walk_time(distance * 1.1),
                                              edge_type="entrance")

            # Kết nối giữa các stop trong cùng 1 stop_area
            for i in range(len(stop_nodes)):
                for j in range(i + 1, len(stop_nodes)):
                    stop1 = stop_nodes[i]
                    stop2 = stop_nodes[j]
                    distance = manhattan_distance(stop1["lat"], stop1["lon"], stop2["lat"], stop2["lon"])
                    graph.add_undirected_edge(stop1["ref"], stop2["ref"], distance, convert_walk_time(distance),
                                              edge_type="transfer")
    
    
    #Kết nối giữa các entrances không có trong relation với stop gần nhất   
    for element in osm_data.get("elements", []):
        if (element.get("type") == "node"
            and "tags" in element
            and element["tags"].get("railway") == "subway_entrance"
            and not isInRelation.get(element["id"], False)
        ):
            closest_stop = None
            closest_distance = float("inf")
            
            for stop_id in stops_in_relation:
                stop_coord = graph.get_coord_by_node(stop_id)
                if stop_coord is None:
                    continue
                distance = manhattan_distance(element["lat"], element["lon"], stop_coord[0], stop_coord[1])
                if distance < closest_distance:
                    closest_distance = distance
                    closest_stop = stop_id
            
            if closest_stop is not None:
                graph.add_undirected_edge(element["id"], closest_stop, closest_distance, convert_walk_time(closest_distance),
                                          edge_type="entrance")
            else:
                logger.warning("Không tìm thấy stop nào gần entrance %d. Bỏ qua.", element["id"])
    return graph


def _process_way(graph: SubwayGraph, way: dict) -> None:
    """Xử lý một way element: tạo cạnh giữa các node liên tiếp.
    Args:
        graph: Đồ thị đang xây dựng.
        way: Phần tử OSM kiểu 'way' chứa thông tin nodes và geometry.
    """
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
        
        # Nếu là đường một chiều, chỉ thêm cạnh từ node1 → node2
        # Chiều Subway luôn được ưu tiên xử lý như một chiều theo thứ tự nodes trong way
        if way.get("tags") is not None and way["tags"].get("railway") == "subway":
            graph.add_edge(node1, node2, distance, convert_subway_time(distance),
                           edge_type="subway", route_id=way.get("id"))
            graph.register_way(node1, way["id"])
            graph.register_way(node2, way["id"])

        elif way.get("tags") == 'forward':
            graph.add_edge(node1, node2, distance, convert_walk_time(distance),
                           edge_type="walk")

        elif way.get("tags") == 'backward':
            graph.add_edge(node2, node1, distance, convert_walk_time(distance),
                           edge_type="walk")

        elif is_oneway:
            graph.add_edge(node1, node2, distance, convert_walk_time(distance),
                           edge_type="walk")

        else:
            graph.add_undirected_edge(node1, node2, distance, convert_walk_time(distance),
                                      edge_type="walk")
            
if __name__ == "__main__":
    graphs = load_graph("data/raw_osm_data.json")

        