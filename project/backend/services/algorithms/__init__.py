"""Algorithm registry — look up routing algorithms by name.

Usage::

    from backend.services.algorithms import get_algorithm

    router = get_algorithm("astar")
    result = router.find_path(graph, start, end)
"""

from __future__ import annotations

from backend.services.algorithms.astar import AStarRouter
from backend.services.algorithms.base import RoutingAlgorithm
from backend.services.algorithms.dijkstra import DijkstraRouter
from backend.services.algorithms.transfer_aware import TransferAwareDijkstra

ALGORITHMS: dict[str, type[RoutingAlgorithm]] = {
    "dijkstra": DijkstraRouter,
    "astar": AStarRouter,
    "transfer_aware": TransferAwareDijkstra,
}

DEFAULT_ALGORITHM = "dijkstra"


def get_algorithm(name: str | None = None) -> RoutingAlgorithm:
    """Return an instance of the named routing algorithm.

    Args:
        name: Algorithm identifier.  Must be a key in ``ALGORITHMS``.
              Defaults to ``DEFAULT_ALGORITHM`` when *None*.

    Raises:
        ValueError: If *name* is not a registered algorithm.
    """
    name = name or DEFAULT_ALGORITHM
    cls = ALGORITHMS.get(name)
    if cls is None:
        valid = ", ".join(sorted(ALGORITHMS))
        raise ValueError(
            f"Unknown algorithm '{name}'. Valid options: {valid}"
        )
    return cls()


def list_algorithms() -> list[str]:
    """Return sorted list of available algorithm names."""
    return sorted(ALGORITHMS.keys())
