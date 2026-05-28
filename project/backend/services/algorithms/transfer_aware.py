"""Transfer-aware Dijkstra routing algorithm.

Extends classic Dijkstra by tracking the *current route* in the search
state.  When the algorithm moves to an edge belonging to a different
route, a configurable transfer penalty is added to the cost.  This
naturally produces paths that prefer staying on the same transit line
when the time difference is small.

Requires the graph to have route metadata on edges.  Falls back to
standard Dijkstra behavior when edges have no route information.
"""

from __future__ import annotations

import heapq
import logging

from backend.models.graph import SubwayGraph
from backend.models.types import PathResult, RoutingConstraints
from backend.services.algorithms.base import RoutingAlgorithm

logger = logging.getLogger(__name__)

# Sentinel for "no route" — used for walking / non-transit edges.
_NO_ROUTE = -1


class TransferAwareDijkstra(RoutingAlgorithm):
    """Dijkstra variant that penalizes route changes (transfers)."""

    name = "transfer_aware"

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
        transfer_penalty = constraints.transfer_penalty_s / 60.0  # convert to minutes
        avoid_routes = set(constraints.avoid_routes)

        # State: (cost, node_id, current_route_id)
        # We need route-aware states because arriving at the same node
        # on a different route has a different "future cost" profile.
        start_state = (0.0, start_node, _NO_ROUTE)
        # cost[(node, route)] = best known cost
        cost: dict[tuple[int, int], float] = {(start_node, _NO_ROUTE): 0.0}
        distance_cost: dict[tuple[int, int], float] = {(start_node, _NO_ROUTE): 0.0}
        previous: dict[tuple[int, int], tuple[int, int] | None] = {
            (start_node, _NO_ROUTE): None
        }
        transfer_count: dict[tuple[int, int], int] = {(start_node, _NO_ROUTE): 0}

        heap: list[tuple[float, int, int]] = [start_state]
        closed: set[tuple[int, int]] = set()

        # Track the best (node, route) that reached end_node
        best_end_state: tuple[int, int] | None = None

        while heap:
            current_cost, current_node, current_route = heapq.heappop(heap)

            state_key = (current_node, current_route)

            if state_key in closed:
                continue
            closed.add(state_key)

            # Skip blocked nodes
            if graph.blocked_node.get(current_node, False):
                continue

            if current_node == end_node:
                best_end_state = state_key
                break

            if current_cost > cost.get(state_key, float("inf")):
                continue

            # Determine route(s) for the current node
            node_routes = graph.get_way_id(current_node)

            for neighbor, edge_distance, edge_time in graph.adjacency.get(
                current_node, []
            ):
                # Determine the route of this edge
                neighbor_routes = graph.get_way_id(neighbor)

                # Find a common route between current and neighbor (= same line)
                edge_route = _NO_ROUTE
                if node_routes and neighbor_routes:
                    common = set(node_routes) & set(neighbor_routes)
                    if common:
                        # Prefer staying on current_route if possible
                        if current_route in common:
                            edge_route = current_route
                        else:
                            edge_route = next(iter(common))

                # Skip avoided routes
                if edge_route != _NO_ROUTE and edge_route in avoid_routes:
                    continue

                # Check max transfers
                cur_transfers = transfer_count.get(state_key, 0)

                # Calculate transfer penalty
                penalty = 0.0
                is_transfer = False
                if (
                    current_route != _NO_ROUTE
                    and edge_route != _NO_ROUTE
                    and edge_route != current_route
                ):
                    penalty = transfer_penalty
                    is_transfer = True

                    if (
                        constraints.max_transfers is not None
                        and cur_transfers >= constraints.max_transfers
                    ):
                        continue

                new_cost = current_cost + edge_time + penalty
                new_distance = distance_cost.get(state_key, 0.0) + edge_distance
                neighbor_state = (neighbor, edge_route)

                if new_cost < cost.get(neighbor_state, float("inf")):
                    cost[neighbor_state] = new_cost
                    distance_cost[neighbor_state] = new_distance
                    previous[neighbor_state] = state_key
                    transfer_count[neighbor_state] = (
                        cur_transfers + (1 if is_transfer else 0)
                    )
                    heapq.heappush(heap, (new_cost, neighbor, edge_route))

        # ── Check reachability ───────────────────────────────────
        if best_end_state is None:
            return None

        # ── Reconstruct path ─────────────────────────────────────
        path: list[tuple[tuple[float, float], str | None, str]] = []
        current_state: tuple[int, int] | None = best_end_state
        while current_state is not None:
            node_id = current_state[0]
            coord = graph.get_coord_by_node(node_id)
            if graph.get_stop_name(node_id):
                stop_name = graph.get_stop_name(node_id)
                node_type = "stop"
            elif graph.get_entrance_name(node_id):
                stop_name = graph.get_entrance_name(node_id)
                node_type = "entrance"
            else:
                stop_name = None
                node_type = "node"
            path.append((coord, stop_name, node_type))
            current_state = previous.get(current_state)
        path.reverse()

        return PathResult(
            path=path,
            distance_meters=distance_cost[best_end_state],
            estimate_time=cost[best_end_state],
            transfers=transfer_count.get(best_end_state, 0),
            algorithm=self.name,
        )
