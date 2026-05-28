"""Abstract base class for all routing algorithms."""

from __future__ import annotations

from abc import ABC, abstractmethod

from backend.models.graph import SubwayGraph
from backend.models.types import PathResult, RoutingConstraints


class RoutingAlgorithm(ABC):
    """Interface that every routing algorithm must implement.

    Concrete subclasses live alongside this file and are registered in
    ``__init__.py`` so the API layer can look them up by name.
    """

    #: Human-readable name shown in API responses.
    name: str = "base"

    @abstractmethod
    def find_path(
        self,
        graph: SubwayGraph,
        start_node: int,
        end_node: int,
        constraints: RoutingConstraints | None = None,
    ) -> PathResult | None:
        """Find a path between two nodes in *graph*.

        Args:
            graph: The transit graph to search.
            start_node: Origin node id.
            end_node: Destination node id.
            constraints: Optional routing preferences.

        Returns:
            A ``PathResult`` on success, ``None`` if no path exists.
        """
        ...
