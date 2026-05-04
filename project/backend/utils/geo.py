"""Hàm tính khoảng cách Haversine giữa 2 tọa độ trên Trái Đất."""

import math


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Tính khoảng cách (mét) giữa 2 điểm theo công thức Haversine.

    Args:
        lat1, lon1: Tọa độ điểm thứ nhất (độ).
        lat2, lon2: Tọa độ điểm thứ hai (độ).

    Returns:
        Khoảng cách tính bằng mét.
    """
    R = 6_371_000  # Bán kính Trái Đất (mét)
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c
