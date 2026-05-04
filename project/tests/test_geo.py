"""Tests cho hàm Haversine distance."""

from backend.utils.geo import haversine_distance


class TestHaversineDistance:

    def test_same_point_returns_zero(self):
        """Khoảng cách giữa 1 điểm với chính nó = 0."""
        assert haversine_distance(35.0, 135.0, 35.0, 135.0) == 0.0

    def test_known_distance_tokyo_osaka(self):
        """Khoảng cách Tokyo → Osaka ~ 395 km (sai số < 5 km)."""
        # Tokyo: 35.6762, 139.6503
        # Osaka: 34.6937, 135.5023
        dist = haversine_distance(35.6762, 139.6503, 34.6937, 135.5023)
        assert 390_000 < dist < 400_000  # ~395 km

    def test_short_distance(self):
        """Khoảng cách ngắn giữa 2 điểm gần nhau ở Kyoto."""
        # 2 điểm cách nhau ~1 km
        dist = haversine_distance(35.0116, 135.7681, 35.0200, 135.7681)
        assert 900 < dist < 1000  # ~933 m

    def test_symmetric(self):
        """Khoảng cách A→B = B→A."""
        d1 = haversine_distance(35.0, 135.0, 36.0, 136.0)
        d2 = haversine_distance(36.0, 136.0, 35.0, 135.0)
        assert abs(d1 - d2) < 0.01  # Sai số < 0.01m

    def test_returns_meters(self):
        """Kết quả trả về đơn vị mét (không phải km)."""
        dist = haversine_distance(35.0, 135.0, 35.001, 135.0)
        # 0.001 độ latitude ~ 111 mét
        assert 100 < dist < 120
