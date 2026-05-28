"""Dijkstra shortest-path algorithm on SubwayGraph.

Refactored from the original monolithic ``pathfinding.py`` into the
pluggable ``RoutingAlgorithm`` interface.  The core logic — a standard
priority-queue Dijkstra optimizing travel time — is unchanged.
"""

from __future__ import annotations

import heapq
import logging

from backend.models.graph import SubwayGraph
from backend.models.types import PathResult, RoutingConstraints
from backend.services.algorithms.base import RoutingAlgorithm

logger = logging.getLogger(__name__)


class DijkstraRouter(RoutingAlgorithm):
    """Classic Dijkstra (time-optimized) with blocked-node support."""

    name = "dijkstra"

    def find_path(
        self,
        graph: SubwayGraph,
        start_node: int,
        end_node: int,
        constraints: RoutingConstraints | None = None,
    ) -> PathResult | None:
        if start_node not in graph.adjacency or end_node not in graph.adjacency:
            logger.warning(
                "Node not in graph: start=%s, end=%s", start_node, end_node
            )
            return None

        constraints = constraints or RoutingConstraints()
        optimize_distance = constraints.optimize == "distance"

        # ── Dijkstra core ────────────────────────────────────────
        previous: dict[int, int | None] = {start_node: None}
        cost: dict[int, float] = {start_node: 0.0}
        distance_cost: dict[int, float] = {start_node: 0.0}
        heap: list[tuple[float, int]] = [(0.0, start_node)]

        while heap:
            current_cost, current_node = heapq.heappop(heap)

            # Skip blocked nodes
            if graph.blocked_node.get(current_node, False):
                continue

            if current_node == end_node:
                break

            if current_cost > cost.get(current_node, float("inf")):
                continue

            for neighbor, edge_distance, edge_time in graph.adjacency.get(
                current_node, []
            ):
                # Choose primary cost metric
                edge_cost = edge_distance if optimize_distance else edge_time

                new_cost = current_cost + edge_cost
                new_distance = distance_cost.get(current_node, 0.0) + edge_distance

                if new_cost < cost.get(neighbor, float("inf")):
                    cost[neighbor] = new_cost
                    distance_cost[neighbor] = new_distance
                    previous[neighbor] = current_node
                    heapq.heappush(heap, (new_cost, neighbor))

        # ── Check reachability ───────────────────────────────────
        if cost.get(end_node, float("inf")) == float("inf"):
            return None

        # ── Reconstruct path ─────────────────────────────────────
        path: list[tuple[tuple[float, float], str | None, str]] = []
        current: int | None = end_node
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
            path.append((coord, stop_name, node_type))
            current = previous.get(current)
        path.reverse()

        return PathResult(
            path=path,
            distance_meters=distance_cost[end_node],
            estimate_time=cost[end_node] if not optimize_distance else cost[end_node],
            algorithm=self.name,
        )
