"""A* / Dijkstra tìm đường đi ngắn nhất / nhanh nhất trên SubwayGraph.

Dùng A* với heuristic Haversine thay vì Dijkstra thuần:
- Dijkstra expand đều ra mọi hướng → chậm trên graph dày (OSM track nodes).
- A* ưu tiên node nào nằm GẦN ĐÍCH về địa lý → giảm mạnh số node cần expand.

Heuristic admissible (không bao giờ overestimate):
  - Tối ưu distance : h = haversine(current, end)          [meters]
  - Tối ưu time     : h = haversine(current, end) / 500    [phút, dựa trên tốc độ tàu 30 km/h]
"""

from __future__ import annotations

import heapq
import math
import logging
from collections import defaultdict
from dataclasses import dataclass

from backend.models.graph import SubwayGraph

logger = logging.getLogger(__name__)

# Tốc độ tàu điện ngầm tối đa = 30 km/h = 500 m/phút
_MAX_SPEED_M_PER_MIN: float = 500.0


# ─────────────────────── Data classes ───────────────────────


@dataclass
class PathResult:
    """Kết quả tìm đường đi.

    Attributes:
        path: Danh sách [(lat, lon), stop_name, type] từ start → end.
        distance_meters: Tổng khoảng cách (mét).
        estimate_time: Tổng thời gian ước tính (phút).
    """
    path: list
    distance_meters: float
    estimate_time: float


@dataclass
class BothPathsResult:
    """Kết quả gộp cả 2 chế độ tìm đường.

    Attributes:
        shortest: Đường đi ngắn nhất (tối ưu theo khoảng cách).
        fastest:  Đường đi nhanh nhất (tối ưu theo thời gian).
    """
    shortest: PathResult | None
    fastest: PathResult | None


# ─────────────────────── Heuristic ──────────────────────────


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Khoảng cách đường chim bay (mét) — dùng làm heuristic cho A*."""
    R = 6_371_000.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1))
         * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2.0 * math.asin(math.sqrt(a))


def _heuristic(
    node_coord: tuple[float, float] | None,
    end_coord: tuple[float, float],
    use_distance: bool,
) -> float:
    """Heuristic admissible cho A*.

    - use_distance=True  → h = khoảng cách đường chim bay (mét).
                           Admissible vì path thực ≥ đường thẳng.
    - use_distance=False → h = khoảng cách / tốc độ tối đa (phút).
                           Admissible vì không node nào nhanh hơn tốc độ tàu tối đa.
    """
    if node_coord is None:
        return 0.0
    d = _haversine_meters(node_coord[0], node_coord[1], end_coord[0], end_coord[1])
    return d if use_distance else d / _MAX_SPEED_M_PER_MIN


# ─────────────────────── Core A* ────────────────────────────


def _astar(
    graph: SubwayGraph,
    start_node: int,
    end_node: int,
    use_distance: bool = False,
) -> PathResult | None:
    """Chạy A* với heuristic địa lý.

    - Heap entry: (f_cost, node)  — f = g + h
    - g_cost = chi phí thực từ start tới node (distance hoặc time)
    - h      = heuristic Haversine tới end_node
    - visited set đảm bảo mỗi node chỉ được settle đúng 1 lần

    Luôn tích lũy cả distance lẫn time, chỉ khác tiêu chí tối ưu (g_cost).

    Args:
        graph:        Đồ thị mạng lưới đường sắt.
        start_node:   Node ID điểm bắt đầu.
        end_node:     Node ID điểm kết thúc.
        use_distance: True → tối ưu khoảng cách; False → tối ưu thời gian.

    Returns:
        PathResult nếu tìm được đường, None nếu không có đường.
    """
    end_coord = graph.get_coord_by_node(end_node)
    if end_coord is None:
        return None

    # g[node] = chi phí thực tích lũy (distance hoặc time)
    g: dict[int, float] = defaultdict(lambda: math.inf)
    g[start_node] = 0.0

    # Luôn track cả 2 chiều để response trả về đầy đủ
    distance_acc: dict[int, float] = {start_node: 0.0}
    time_acc:     dict[int, float] = {start_node: 0.0}

    previous: dict[int, int | None] = {start_node: None}
    visited:  set[int]              = set()

    start_coord = graph.get_coord_by_node(start_node)
    h0 = _heuristic(start_coord, end_coord, use_distance)
    heap: list[tuple[float, int]] = [(h0, start_node)]

    while heap:
        f, current_node = heapq.heappop(heap)

        if current_node in visited:
            continue

        if current_node == end_node:
            break

        visited.add(current_node)

        g_current = g[current_node]

        for neighbor, edge_distance, edge_time in graph.adjacency.get(current_node, []):
            if graph.blocked_node.get(neighbor, False):
                continue

            edge_cost = edge_distance if use_distance else edge_time
            tentative_g = g_current + edge_cost

            if tentative_g < g[neighbor]:
                g[neighbor]            = tentative_g
                distance_acc[neighbor] = distance_acc[current_node] + edge_distance
                time_acc[neighbor]     = time_acc[current_node]     + edge_time
                previous[neighbor]     = current_node

                neighbor_coord = graph.get_coord_by_node(neighbor)
                h = _heuristic(neighbor_coord, end_coord, use_distance)
                heapq.heappush(heap, (tentative_g + h, neighbor))

    if math.isinf(g[end_node]):
        return None

    # Truy vết đường đi
    path = []
    current = end_node
    while current is not None:
        coord = graph.get_coord_by_node(current)
        if graph.get_stop_name(current):
            stop_name = graph.get_stop_name(current)
            node_type = "stop"
        elif graph.get_entrance_name(current):
            stop_name = graph.get_entrance_name(current)
            node_type = "entrance"
        else:
            stop_name = None
            node_type = "node"
        # Đánh dấu node thuộc subway track hay không (dựa vào way_map)
        is_subway = graph.get_way_id(current) is not None
        # Tên đường/tuyến của node (subway line name hoặc highway name)
        way_name = graph.get_way_name(current)
        path.append((coord, stop_name, node_type, is_subway, way_name))
        current = previous.get(current)
    path.reverse()

    return PathResult(
        path=path,
        distance_meters=distance_acc[end_node],
        estimate_time=time_acc[end_node],
    )


# ─────────────────────── Public API ─────────────────────────


def find_both_paths(
    graph: SubwayGraph,
    start_coord: list[float],
    end_coord: list[float],
) -> BothPathsResult:
    """Tìm đồng thời đường ngắn nhất (distance) và nhanh nhất (time).

    Chạy A* 2 lần với tiêu chí khác nhau. Cả 2 lần đều theo dõi
    đầy đủ cả distance lẫn time để response trả về thông số hoàn chỉnh.

    Args:
        graph:       Đồ thị mạng lưới đường sắt.
        start_coord: [lat, lon] điểm bắt đầu.
        end_coord:   [lat, lon] điểm kết thúc.

    Returns:
        BothPathsResult(shortest, fastest) — một trong hai có thể là None.
    """
    start_node = graph.get_node_by_coord(start_coord[0], start_coord[1])
    end_node   = graph.get_node_by_coord(end_coord[0],   end_coord[1])

    if start_node is None or end_node is None:
        logger.warning(
            "Không tìm thấy node cho tọa độ: start=%s, end=%s",
            start_coord, end_coord,
        )
        return BothPathsResult(shortest=None, fastest=None)

    if start_node not in graph.adjacency or end_node not in graph.adjacency:
        logger.warning(
            "Node không tồn tại trong đồ thị: start=%s, end=%s",
            start_node, end_node,
        )
        return BothPathsResult(shortest=None, fastest=None)

    shortest = _astar(graph, start_node, end_node, use_distance=True)
    fastest  = _astar(graph, start_node, end_node, use_distance=False)

    return BothPathsResult(shortest=shortest, fastest=fastest)


# ── Legacy (giữ tương thích với /save_input) ─────────────────

def find_shortest_path(
    graph: SubwayGraph,
    start_coord: list[float],
    end_coord: list[float],
) -> PathResult | None:
    """Legacy: tìm đường nhanh nhất (minimize time). Dùng cho /save_input."""
    start_node = graph.get_node_by_coord(start_coord[0], start_coord[1])
    end_node   = graph.get_node_by_coord(end_coord[0],   end_coord[1])

    if start_node is None or end_node is None:
        return None
    if start_node not in graph.adjacency or end_node not in graph.adjacency:
        return None

    return _astar(graph, start_node, end_node, use_distance=False)
