"""Routing orchestrator — resolves coordinates to nodes and delegates
to the pluggable algorithm system.

The original ``PathResult`` dataclass is re-exported from
``backend.models.types`` for backward compatibility.  The
``find_shortest_path`` function signature is kept identical so that
existing callers (``api.py``) continue to work without changes.
"""

from __future__ import annotations

import logging

from backend.models.graph import SubwayGraph
from backend.models.types import PathResult, RoutingConstraints  # noqa: F401 — re-export
from backend.services.algorithms import get_algorithm

logger = logging.getLogger(__name__)


def find_shortest_path(
    graph: SubwayGraph,
    start_coord: list[float],
    end_coord: list[float],
    algorithm: str | None = None,
    constraints: RoutingConstraints | None = None,
) -> PathResult | None:
    """Find the fastest path between two coordinates.

    This is the main entry point used by the API layer.  It resolves
    lat/lon coordinates to graph node ids, picks the requested algorithm,
    and delegates.

    Args:
        graph: The transit graph to search.
        start_coord: ``[lat, lon]`` of the origin.
        end_coord: ``[lat, lon]`` of the destination.
        algorithm: Algorithm name (``"dijkstra"``, ``"astar"``,
            ``"transfer_aware"``).  Defaults to Dijkstra.
        constraints: Optional routing preferences.

    Returns:
        A ``PathResult`` on success, ``None`` if no path exists.
    """
    start_node = graph.get_node_by_coord(start_coord[0], start_coord[1])
    end_node = graph.get_node_by_coord(end_coord[0], end_coord[1])

    if start_node is None or end_node is None:
        logger.warning(
            "Coordinate not found in graph: start=%s, end=%s",
            start_coord,
            end_coord,
        )
        return None

    router = get_algorithm(algorithm)
    return router.find_path(graph, start_node, end_node, constraints)
