"""SubwayGraph — Đồ thị mạng lưới đường sắt Kyoto.

Đóng gói toàn bộ dữ liệu đồ thị (adjacency list, node map, stop map)
vào một class duy nhất, thay vì sử dụng biến global.
"""
from __future__ import annotations

COORD_PRECISION = 7  # Số chữ số thập phân khi làm tròn tọa độ


class SubwayGraph:
    """Đồ thị có trọng số biểu diễn mạng lưới đường sắt.

    Attributes:
        adjacency: Dict node_id → list[(neighbor_id, distance_meters, time_travel)].
        node_map: Ánh xạ 2 chiều giữa (lat, lon) và node_id.
        stop_map: Ánh xạ (lat, lon) hoặc node_id → tên trạm/điểm dừng.
        way_map: Dict node_id → list id các con đường (chỉ subway).
        way_name_map: Dict node_id → tên đường (highway name, subway line name).
        blocked_Node: Dict node_id → True nếu node bị chặn, False hoặc không tồn tại nếu không bị chặn.
    """
    
    def __init__(self):
        self.adjacency: dict[int, list[tuple[int, float, float]]] = {}
        self.node_map: dict = {}  # (lat,lon) → node_id VÀ node_id → (lat,lon)
        self.stop_map: dict = {}  # node_id → tên trạm
        self.entrance_map: dict = {} # node_id → tên entrance
        self.way_map: dict[int, list[int]] = {}  # node_id → list id đường (chỉ subway)
        self.way_name_map: dict[int, str] = {}   # node_id → tên đường/tuyến
        self.blocked_node: dict[int, bool] = {}  # node_id → True
        
    def ensure_node(self, node_id: int) -> None:
        """Đảm bảo node_id tồn tại trong adjacency list."""
        if node_id not in self.adjacency:
            self.adjacency[node_id] = []

    def add_edge(self, from_id: int, to_id: int, distance: float, time: float) -> None:
        """Thêm cạnh một chiều từ from_id → to_id."""
        self.ensure_node(from_id)
        self.ensure_node(to_id)
        # Tránh cạnh trùng lặp
        if not any(neighbor == to_id for neighbor, _, _ in self.adjacency[from_id]):
            self.adjacency[from_id].append((to_id, distance, time))

    def add_undirected_edge(self, node1: int, node2: int, distance: float, time: float) -> None:
        """Thêm cạnh hai chiều giữa node1 và node2."""
        self.add_edge(node1, node2, distance, time)
        self.add_edge(node2, node1, distance, time)

    def register_node_coord(self, node_id: int, lat: float, lon: float) -> None:
        """Đăng ký ánh xạ 2 chiều giữa node_id và tọa độ."""
        coord = (round(lat, COORD_PRECISION), round(lon, COORD_PRECISION))
        if coord not in self.node_map:
            self.node_map[coord] = node_id
        if node_id not in self.node_map:
            self.node_map[node_id] = coord

    def register_stop(self, node_id: int, lat: float, lon: float, name: str) -> None:
        """Đăng ký tên trạm/điểm dừng cho một node."""
        coord = (round(lat, COORD_PRECISION), round(lon, COORD_PRECISION))
        if coord not in self.stop_map:
            self.stop_map[coord] = name
        if node_id not in self.stop_map:
            self.stop_map[node_id] = name

    def register_entrance(self, node_id: int, lat: float, lon: float, name: str) -> None:
        """Đăng ký tên entrance cho một node."""
        coord = (round(lat, COORD_PRECISION), round(lon, COORD_PRECISION))
        if coord not in self.entrance_map:
            self.entrance_map[coord] = name
        if node_id not in self.entrance_map:
            self.entrance_map[node_id] = name
        
    def register_way(self, node_id: int, way_id: int) -> None:
        """Đăng ký way_id và way_type cho một node."""
        if node_id not in self.way_map:
            self.way_map[node_id] = []
            self.way_map[node_id].append(way_id)

    def register_way_name(self, node_id: int, name: str) -> None:
        """Đăng ký tên đường/tuyến cho một node (highway hoặc subway line)."""
        if node_id not in self.way_name_map:
            self.way_name_map[node_id] = name

    def get_way_name(self, node_id: int) -> str | None:
        """Lấy tên đường/tuyến của node. Trả về None nếu không có."""
        return self.way_name_map.get(node_id)
        
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

    def get_entrance_name(self, node_id: int) -> str | None:
        """Tìm tên entrance từ node_id. Trả về None nếu không phải entrance."""
        return self.entrance_map.get(node_id)

    def get_way_id(self, node_id: int) -> list[tuple[int, str]] | None:
        """Tìm danh sách tên đường từ node_id. Trả về danh sách rỗng nếu không có đường."""
        return self.way_map.get(node_id, None)
   
    @property
    def node_count(self) -> int:
        """Số lượng node trong đồ thị."""
        return len(self.adjacency)

    @property
    def edge_count(self) -> int:
        """Tổng số cạnh (có hướng) trong đồ thị."""
        return sum(len(neighbors) for neighbors in self.adjacency.values())

    
    