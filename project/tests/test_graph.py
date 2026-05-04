"""Tests cho SubwayGraph và quá trình xây dựng đồ thị từ dữ liệu OSM."""

from backend.models.graph import SubwayGraph


class TestSubwayGraph:

    def test_add_edge(self):
        """Thêm cạnh một chiều."""
        g = SubwayGraph()
        g.add_edge(1, 2, 100.0)
        assert (2, 100.0) in g.adjacency[1]
        assert 1 in g.adjacency  # node 1 tồn tại
        assert 2 in g.adjacency  # node 2 được tạo

    def test_add_undirected_edge(self):
        """Thêm cạnh hai chiều."""
        g = SubwayGraph()
        g.add_undirected_edge(1, 2, 50.0)
        assert (2, 50.0) in g.adjacency[1]
        assert (1, 50.0) in g.adjacency[2]

    def test_no_duplicate_edges(self):
        """Không thêm cạnh trùng lặp."""
        g = SubwayGraph()
        g.add_edge(1, 2, 100.0)
        g.add_edge(1, 2, 100.0)  # Trùng
        assert len(g.adjacency[1]) == 1

    def test_register_and_lookup_coord(self):
        """Đăng ký và tra cứu tọa độ ↔ node_id."""
        g = SubwayGraph()
        g.register_node_coord(42, 35.0100, 135.7700)
        assert g.get_node_by_coord(35.0100, 135.7700) == 42
        assert g.get_coord_by_node(42) == (35.0100, 135.7700)

    def test_register_and_lookup_stop(self):
        """Đăng ký và tra cứu tên trạm."""
        g = SubwayGraph()
        g.register_stop(10, 35.01, 135.77, "Kyoto Station")
        assert g.get_stop_name(10) == "Kyoto Station"

    def test_node_count_and_edge_count(self):
        """Đếm số node và cạnh."""
        g = SubwayGraph()
        g.add_undirected_edge(1, 2, 10.0)
        g.add_edge(2, 3, 20.0)
        assert g.node_count == 3
        assert g.edge_count == 3  # 1→2, 2→1, 2→3

    def test_get_nonexistent_node_returns_none(self):
        """Tra cứu node không tồn tại trả về None."""
        g = SubwayGraph()
        assert g.get_node_by_coord(0.0, 0.0) is None
        assert g.get_coord_by_node(999) is None
        assert g.get_stop_name(999) is None


class TestBuildGraph:

    def test_builds_from_osm_data(self, test_graph):
        """Đồ thị được xây dựng đúng từ dữ liệu test."""
        # 6 nodes tổng cộng
        assert test_graph.node_count == 6

    def test_stop_names_registered(self, test_graph):
        """Tên trạm được đăng ký chính xác."""
        assert test_graph.get_stop_name(2) == "Station B"
        assert test_graph.get_stop_name(4) == "Station D"

    def test_two_way_edges(self, test_graph):
        """Way hai chiều tạo cạnh ở cả 2 hướng."""
        # Way 101: 1↔2↔3, Way 102: 2↔4
        neighbors_of_2 = [n for n, _ in test_graph.adjacency[2]]
        assert 1 in neighbors_of_2  # từ way 101
        assert 3 in neighbors_of_2  # từ way 101
        assert 4 in neighbors_of_2  # từ way 102

    def test_one_way_edges(self, test_graph):
        """Way một chiều chỉ tạo cạnh 1 hướng."""
        # Way 103: D→E→F (oneway)
        neighbors_of_4 = [n for n, _ in test_graph.adjacency[4]]
        assert 5 in neighbors_of_4  # 4→5 OK

        neighbors_of_5 = [n for n, _ in test_graph.adjacency[5]]
        assert 4 not in neighbors_of_5  # 5→4 KHÔNG tồn tại (one-way)
        assert 6 in neighbors_of_5  # 5→6 OK
