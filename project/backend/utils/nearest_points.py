"""This module provides a function to find the nearest points in a graph using a KDTree."""
"""O (N log N) để xây dựng KDTree và O(log N) để truy vấn mỗi điểm."""

from scipy.spatial import KDTree
import numpy as np
from backend.models.graph import SubwayGraph
def build_spatial_index(graph: SubwayGraph) -> tuple[KDTree, list[int]]:
    """Xây dựng KDTree từ tọa độ của các node trong đồ thị."""
    node_ids = []
    coords = []
    for node_id, coord in graph.node_map.items():
        if isinstance(node_id, int) and isinstance(coord, tuple):
            coords.append(coord)
            node_ids.append(node_id)    
    return KDTree(np.array(coords)), node_ids

def find_nearest_node(Tree: KDTree, node_ids: list, lat: float, lon: float) -> [int, float] | [None, float]:
    """ Tìm node_id gần nhất từ tọa độ (lat, lon) sử dụng KDTree"""
    distance, idx = Tree.query([lat, lon], k = 1)
    return [node_ids[idx], distance] if idx < len(node_ids) else [None, float('inf')]