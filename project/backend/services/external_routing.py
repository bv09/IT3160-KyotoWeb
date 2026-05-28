"""External routing engine proxy — OSRM and OpenRouteService (ORS).

Inspired by FacilMap's ``routing.ts`` → ``osrm.ts`` / ``ors.ts``
dispatcher pattern.  This module handles walking-segment routing
using external engines while internal transit routing stays in
``pathfinding.py``.

Configuration (via ``backend.config``):
    ``ORS_TOKEN`` — OpenRouteService API key
    ``OSRM_URL`` — Self-hosted OSRM instance (optional)
    ``WALKING_ENGINE`` — ``"internal"`` | ``"osrm"`` | ``"ors"``
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import requests

from backend.config import BaseConfig as config
from backend.utils.convert_to_time import convert_walk_time
from backend.utils.geo import haversine_distance

logger = logging.getLogger(__name__)

# Default OSRM public demo server — rate-limited, not for production.
_DEFAULT_OSRM_URL = "https://router.project-osrm.org"

# ORS base URL (v2 /directions endpoint).
_ORS_URL = "https://api.openrouteservice.org/v2/directions"


@dataclass
class WalkingRoute:
    """Result of a walking-routing request.

    Attributes:
        track_points: Ordered list of (lat, lon) representing the path.
        distance_m: Total distance in meters.
        time_s: Total travel time in seconds.
        ascent: Cumulative ascent in meters (only from ORS).
        descent: Cumulative descent in meters (only from ORS).
    """

    track_points: list[tuple[float, float]]
    distance_m: float
    time_s: float
    ascent: float | None = None
    descent: float | None = None

    @property
    def time_min(self) -> float:
        return self.time_s / 60.0


class ExternalRouter:
    """Proxy that dispatches walking-routing requests.

    Usage::

        router = ExternalRouter()
        route = router.calculate_walking_route(
            (35.011, 135.768), (35.009, 135.773)
        )
        # route.track_points  -> [(lat, lon), ...]
    """

    def __init__(
        self,
        engine: str | None = None,
        ors_token: str | None = None,
        osrm_url: str | None = None,
    ):
        self.engine = engine or getattr(config, "WALKING_ENGINE", "internal")
        self.ors_token = ors_token or getattr(config, "ORS_TOKEN", "") or None
        self.osrm_url = (
            osrm_url or getattr(config, "OSRM_URL", "")
            or _DEFAULT_OSRM_URL
        )

    # ── Public API ────────────────────────────────────────────────

    def calculate_walking_route(
        self,
        start: tuple[float, float],
        end: tuple[float, float],
    ) -> WalkingRoute:
        """Route a walking segment between two points.

        Args:
            start: (lat, lon) of the origin.
            end: (lat, lon) of the destination.

        Returns:
            A ``WalkingRoute`` with track points and statistics.
        """
        if self.engine == "ors" and self.ors_token:
            return self._ors_walking(start, end)
        if self.engine == "osrm":
            return self._osrm_walking(start, end)

        # Fall back to straight-line estimate (engine == "internal")
        return self._internal_walking(start, end)

    def calculate_first_last_mile(
        self,
        user_location: tuple[float, float],
        nearest_stop: tuple[float, float],
    ) -> WalkingRoute:
        """Route from a user location to a nearby transit stop.

        This is a convenience wrapper around ``calculate_walking_route``
        that also handles the degenerate case where the user is already
        at the stop.
        """
        dist = haversine_distance(
            user_location[0], user_location[1],
            nearest_stop[0], nearest_stop[1],
        )
        if dist < 10:  # less than 10m — same location
            return WalkingRoute(
                track_points=[user_location, nearest_stop],
                distance_m=0.0,
                time_s=0.0,
            )
        return self.calculate_walking_route(user_location, nearest_stop)

    # ── Internal engines ─────────────────────────────────────────

    def _internal_walking(
        self, start: tuple[float, float], end: tuple[float, float]
    ) -> WalkingRoute:
        """Straight-line estimate using walking speed (5 km/h)."""
        dist = haversine_distance(start[0], start[1], end[0], end[1])
        time_m = convert_walk_time(dist)
        return WalkingRoute(
            track_points=[start, end],
            distance_m=dist,
            time_s=time_m * 60.0,
        )

    # ── OSRM ─────────────────────────────────────────────────────

    def _osrm_walking(
        self, start: tuple[float, float], end: tuple[float, float]
    ) -> WalkingRoute:
        """Call the OSRM API for pedestrian routing."""
        coords = f"{start[1]},{start[0]};{end[1]},{end[0]}"
        url = (
            f"{self.osrm_url}/route/v1/foot/{coords}"
            "?alternatives=false"
            "&steps=false"
            "&geometries=geojson"
            "&overview=full"
        )

        try:
            resp = requests.get(
                url,
                headers={"User-Agent": "KyotoPathfindingApp/2.0"},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
        except requests.RequestException as exc:
            logger.warning("OSRM request failed: %s. Falling back to internal.", exc)
            return self._internal_walking(start, end)

        if data.get("code") != "Ok" or not data.get("routes"):
            logger.warning("OSRM returned no route. Falling back to internal.")
            return self._internal_walking(start, end)

        route = data["routes"][0]
        coords = route.get("geometry", {}).get("coordinates", [])
        track = [(c[1], c[0]) for c in coords]  # OSRM returns [lon, lat]

        return WalkingRoute(
            track_points=track,
            distance_m=route.get("distance", 0),
            time_s=route.get("duration", 0),
        )

    # ── ORS ──────────────────────────────────────────────────────

    def _ors_walking(
        self, start: tuple[float, float], end: tuple[float, float]
    ) -> WalkingRoute:
        """Call the OpenRouteService API for pedestrian routing."""
        if not self.ors_token:
            logger.warning("No ORS token configured. Falling back to internal.")
            return self._internal_walking(start, end)

        payload = {
            "coordinates": [[start[1], start[0]], [end[1], end[0]]],
            "instructions": False,
            "elevation": True,
        }

        headers = {
            "Authorization": self.ors_token,
            "Content-Type": "application/json",
            "User-Agent": "KyotoPathfindingApp/2.0",
        }

        try:
            resp = requests.post(
                f"{_ORS_URL}/foot-walking/geojson",
                json=payload,
                headers=headers,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
        except requests.RequestException as exc:
            logger.warning("ORS request failed: %s. Falling back to internal.", exc)
            return self._internal_walking(start, end)

        if data.get("error") or not data.get("features"):
            logger.warning(
                "ORS returned error: %s. Falling back to internal.",
                data.get("error", {}).get("message", "unknown"),
            )
            return self._internal_walking(start, end)

        feature = data["features"][0]
        coords = feature.get("geometry", {}).get("coordinates", [])
        track = [(c[1], c[0]) for c in coords]

        props = feature.get("properties", {}).get("summary", {})
        return WalkingRoute(
            track_points=track,
            distance_m=props.get("distance", 0),
            time_s=props.get("duration", 0),
            ascent=feature.get("properties", {}).get("ascent"),
            descent=feature.get("properties", {}).get("descent"),
        )