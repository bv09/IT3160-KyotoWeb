"""SubwayGraph — Đồ thị mạng lưới đường sắt Kyoto.

Đóng gói toàn bộ dữ liệu đồ thị (adjacency list, node map, stop map)
vào một class duy nhất, thay vì sử dụng biến global.
"""

from __future__ import annotations

COORD_PRECISION = 7  # Số chữ số thập phân khi làm tròn tọa độ


class SubwayGraph:
    """Đồ thị có trọng số biểu diễn mạng lưới đường sắt.

    Attributes:
        adjacency: Dict node_id → list[(neighbor_id, distance_meters)].
        node_map: Ánh xạ 2 chiều giữa (lat, lon) và node_id.
        stop_map: Ánh xạ (lat, lon) hoặc node_id → tên trạm/điểm dừng.
    """

    def __init__(self):
        self.adjacency: dict[int, list[tuple[int, float]]] = {}
        self.node_map: dict = {}  # (lat,lon) → node_id VÀ node_id → (lat,lon)
        self.stop_map: dict = {}  # (lat,lon) hoặc node_id → tên trạm

    def ensure_node(self, node_id: int) -> None:
        """Đảm bảo node_id tồn tại trong adjacency list."""
        if node_id not in self.adjacency:
            self.adjacency[node_id] = []

    def add_edge(self, from_id: int, to_id: int, distance: float) -> None:
        """Thêm cạnh một chiều từ from_id → to_id."""
        self.ensure_node(from_id)
        self.ensure_node(to_id)
        # Tránh cạnh trùng lặp
        if not any(neighbor == to_id for neighbor, _ in self.adjacency[from_id]):
            self.adjacency[from_id].append((to_id, distance))

    def add_undirected_edge(self, node1: int, node2: int, distance: float) -> None:
        """Thêm cạnh hai chiều giữa node1 và node2."""
        self.add_edge(node1, node2, distance)
        self.add_edge(node2, node1, distance)

    def register_node_coord(self, node_id: int, lat: float, lon: float) -> None:
        """Đăng ký ánh xạ 2 chiều giữa node_id và tọa độ."""
        coord = (round(lat, COORD_PRECISION), round(lon, COORD_PRECISION))
        self.node_map[coord] = node_id
        self.node_map[node_id] = coord

    def register_stop(self, node_id: int, lat: float, lon: float, name: str) -> None:
        """Đăng ký tên trạm/điểm dừng cho một node."""
        coord = (round(lat, COORD_PRECISION), round(lon, COORD_PRECISION))
        self.stop_map[coord] = name
        self.stop_map[node_id] = name

    def get_node_by_coord(self, lat: float, lon: float) -> int | None:
        """Tìm node_id từ tọa độ (lat, lon). Trả về None nếu không tìm thấy."""
        coord = (round(lat, COORD_PRECISION), round(lon, COORD_PRECISION))
        result = self.node_map.get(coord)
        return result if isinstance(result, int) else None

    def get_coord_by_node(self, node_id: int) -> tuple[float, float] | None:
        """Tìm tọa độ (lat, lon) từ node_id. Trả về None nếu không tìm thấy."""
        result = self.node_map.get(node_id)
        return result if isinstance(result, tuple) else None

    def get_stop_name(self, node_id: int) -> str | None:
        """Tìm tên trạm/điểm dừng từ node_id. Trả về None nếu không phải trạm."""
        return self.stop_map.get(node_id)

    @property
    def node_count(self) -> int:
        """Số lượng node trong đồ thị."""
        return len(self.adjacency)

    @property
    def edge_count(self) -> int:
        """Tổng số cạnh (có hướng) trong đồ thị."""
        return sum(len(neighbors) for neighbors in self.adjacency.values())
