"""Thuật toán Dijkstra tìm đường đi ngắn nhất trên SubwayGraph."""

from __future__ import annotations

import heapq
import logging
from dataclasses import dataclass

from backend.models.graph import SubwayGraph

logger = logging.getLogger(__name__)


@dataclass
class PathResult:
    """Kết quả tìm đường đi ngắn nhất.

    Attributes:
        path: Danh sách [(lat, lon), stop_name] theo thứ tự từ start → end.
        distance_meters: Tổng khoảng cách (mét).
    """
    path: list[tuple[tuple[float, float], str | None]]
    distance_meters: float


def find_shortest_path(
    graph: SubwayGraph,
    start_coord: list[float],
    end_coord: list[float],
    bonus_distance: float = 0.0,
) -> PathResult | None:
    """Tìm đường đi ngắn nhất giữa 2 tọa độ.

    Args:
        graph: Đồ thị mạng lưới đường sắt.
        start_coord: Tọa độ [lat, lon] điểm bắt đầu.
        end_coord: Tọa độ [lat, lon] điểm kết thúc.

    Returns:
        PathResult nếu tìm được đường, None nếu không có đường.
    """
    start_node = graph.get_node_by_coord(start_coord[0], start_coord[1])
    end_node = graph.get_node_by_coord(end_coord[0], end_coord[1])

    if start_node is None or end_node is None:
        logger.warning(
            "Không tìm thấy node cho tọa độ: start=%s, end=%s", start_coord, end_coord
        )
        return None

    if start_node not in graph.adjacency or end_node not in graph.adjacency:
        logger.warning(
            "Node không tồn tại trong đồ thị: start=%s, end=%s", start_node, end_node
        )
        return None

    # Dijkstra
    previous = {start_node: None}
    cost = {start_node: 0.0}
    heap = [(0.0, start_node)]

    while heap:
        current_cost, current_node = heapq.heappop(heap)

        if current_node == end_node:
            break

        if current_cost > cost.get(current_node, float("inf")):
            continue

        for neighbor, edge_cost in graph.adjacency.get(current_node, []):
            new_cost = current_cost + edge_cost
            if new_cost < cost.get(neighbor, float("inf")):
                cost[neighbor] = new_cost
                previous[neighbor] = current_node
                heapq.heappush(heap, (new_cost, neighbor))

    # Kiểm tra xem có đường đi không
    if cost.get(end_node, float("inf")) == float("inf"):
        return None

    # Truy vết đường đi
    path = []
    current = end_node
    while current is not None:
        coord = graph.get_coord_by_node(current)
        if (graph.get_stop_name(current)):
            stop_name = graph.get_stop_name(current)
            type = "stop"
        elif (graph.get_entrance_name(current)):
            stop_name = graph.get_entrance_name(current)
            type = "entrance"
        else:
            stop_name = None
            type = "node"
        
        path.append((coord, stop_name, type))
        current = previous.get(current)
    path.reverse()

    return PathResult(path=path, distance_meters=cost[end_node] + bonus_distance)
