"""A* shortest-path algorithm on SubwayGraph.

Uses the Haversine straight-line distance divided by the maximum
vehicle speed as an *admissible* heuristic, guaranteeing optimal
results while exploring fewer nodes than Dijkstra on geographic
graphs.
"""

from __future__ import annotations

import heapq
import logging

from backend.models.graph import SubwayGraph
from backend.models.types import PathResult, RoutingConstraints
from backend.services.algorithms.base import RoutingAlgorithm
from backend.utils.geo import haversine_distance

logger = logging.getLogger(__name__)

# Maximum speed in m/s — used to compute a *lower bound* on travel
# time so the heuristic stays admissible.  50 km/h ≈ subway speed.
_MAX_SPEED_MS = 50_000 / 3600  # ≈ 13.89 m/s


class AStarRouter(RoutingAlgorithm):
    """A* search with Haversine heuristic (time-optimized)."""

    name = "astar"

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

        end_coord = graph.get_coord_by_node(end_node)
        if end_coord is None:
            return None

        def heuristic(node_id: int) -> float:
            """Admissible heuristic: straight-line time lower bound."""
            coord = graph.get_coord_by_node(node_id)
            if coord is None:
                return 0.0
            dist_m = haversine_distance(coord[0], coord[1], end_coord[0], end_coord[1])
            if optimize_distance:
                return dist_m
            # Convert distance to minimum possible time (minutes)
            return dist_m / _MAX_SPEED_MS / 60.0

        # ── A* core ─────────────────────────────────────────────
        # g_cost = actual cost from start
        g_cost: dict[int, float] = {start_node: 0.0}
        distance_cost: dict[int, float] = {start_node: 0.0}
        previous: dict[int, int | None] = {start_node: None}

        # Priority queue entries: (f_cost, node_id)
        h0 = heuristic(start_node)
        heap: list[tuple[float, int]] = [(h0, start_node)]
        closed: set[int] = set()

        while heap:
            f_current, current_node = heapq.heappop(heap)

            if current_node == end_node:
                break

            if current_node in closed:
                continue
            closed.add(current_node)

            # Skip blocked nodes
            if graph.blocked_node.get(current_node, False):
                continue

            for neighbor, edge_distance, edge_time in graph.adjacency.get(
                current_node, []
            ):
                if neighbor in closed:
                    continue

                edge_cost = edge_distance if optimize_distance else edge_time
                tentative_g = g_cost[current_node] + edge_cost
                new_distance = distance_cost[current_node] + edge_distance

                if tentative_g < g_cost.get(neighbor, float("inf")):
                    g_cost[neighbor] = tentative_g
                    distance_cost[neighbor] = new_distance
                    previous[neighbor] = current_node
                    f = tentative_g + heuristic(neighbor)
                    heapq.heappush(heap, (f, neighbor))

        # ── Check reachability ───────────────────────────────────
        if g_cost.get(end_node, float("inf")) == float("inf"):
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
            estimate_time=g_cost[end_node],
            algorithm=self.name,
        )
