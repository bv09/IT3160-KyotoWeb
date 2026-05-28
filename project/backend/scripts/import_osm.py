"""One-shot OSM data import into PostgreSQL/PostGIS.

Parses ``raw_osm_data.json`` (or ``raw_osm_data_v2.json``) and populates
the ``stops``, ``routes``, ``route_stops``, ``stop_areas``,
``stop_area_members``, and ``edges`` tables.

Usage::

    python -m backend.scripts.import_osm [--input data/raw_osm_data_v2.json]
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from collections import defaultdict
from pathlib import Path

from backend.db.engine import get_session
from backend.db.models import (
    BlockedStop,
    Edge,
    Route,
    RouteStop,
    Stop,
    StopArea,
    StopAreaMember,
)
from backend.utils.convert_to_time import convert_subway_time, convert_walk_time
from backend.utils.geo import haversine_distance, manhattan_distance

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def import_osm_to_db(filepath: str, clear_first: bool = False) -> dict:
    """Parse OSM JSON and populate the database.

    Args:
        filepath: Path to a JSON file from the Overpass API.
        clear_first: If True, truncate all routing tables before importing.

    Returns:
        Dict with import statistics.
    """
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"OSM data file not found: {filepath}")

    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    elements = raw.get("elements", [])
    if not elements:
        raise ValueError("No elements found in OSM data file.")

    session = get_session()

    if clear_first:
        logger.info("Truncating existing tables...")
        for table in [BlockedStop, Edge, RouteStop, Route, StopAreaMember, StopArea, Stop]:
            session.query(table).delete()
        session.commit()

    try:
        stats = _import_elements(session, elements)
        session.commit()
        logger.info("Import complete: %s", stats)
        return stats
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ── Internal helpers ──────────────────────────────────────────────

def _import_elements(session, elements: list[dict]) -> dict:
    """Process all OSM elements and insert into the database."""
    stats: dict = defaultdict(int)

    # ── Pass 1: identify & register stops ────────────────────────
    stop_candidates: list[dict] = []
    ways: list[dict] = []
    relations: list[dict] = []

    for el in elements:
        t = el.get("type")
        if t == "node":
            stop_candidates.append(el)
        elif t == "way":
            ways.append(el)
        elif t == "relation":
            relations.append(el)

    # Build lookup: osm_id -> db Stop record
    osm_to_stop: dict[int, Stop] = {}

    for el in stop_candidates:
        tags = el.get("tags") or {}
        stop_type = _classify_stop_type(tags)
        if stop_type is None:
            continue  # not a transit stop

        mode = tags.get("subway") and "subway" or tags.get(
            "bus") and "bus" or tags.get("tram") and "tram" or "subway"
        name = tags.get("name:en", tags.get("name", f"Stop_{el['id']}"))
        name_en = tags.get("name:en", tags.get("name", ""))

        s = Stop(
            osm_id=el["id"],
            name=name,
            name_en=name_en,
            stop_type=stop_type,
            mode=mode,
            lat=el.get("lat", 0),
            lon=el.get("lon", 0),
            wheelchair=tags.get("wheelchair") == "yes",
            network=tags.get("network"),
            operator=tags.get("operator"),
        )
        session.add(s)
        session.flush()  # assign s.id
        osm_to_stop[el["id"]] = s
        stats["stops"] += 1

    logger.info("Registered %d stops.", stats["stops"])

    # ── Pass 2: process route relations & edges ──────────────────
    for rel in relations:
        tags = rel.get("tags") or {}
        rt = tags.get("route")
        if rt in ("subway", "bus", "tram", "train", "light_rail") and tags.get(
            "type"
        ) == "route":
            _import_route_relation(session, rel, osm_to_stop, stats)
        elif (
            tags.get("type") == "public_transport"
            and tags.get("public_transport") == "stop_area"
        ):
            _import_stop_area(session, rel, osm_to_stop, stats)

    logger.info("Imported %d routes and %d stop_areas.", stats.get("routes", 0), stats.get("stop_areas", 0))

    # ── Pass 3: process ways for graph edges ─────────────────────
    for way in ways:
        _import_way_edges(session, way, osm_to_stop, stats)

    logger.info("Imported %d edges.", stats.get("edges", 0))

    # ── Pass 4: connect entrances without stop_area to nearest stop
    stats["entrance_links"] = 0
    entrance_nodes = [
        s for s in osm_to_stop.values() if s.stop_type == "entrance"
    ]
    stop_nodes = [
        s for s in osm_to_stop.values()
        if s.stop_type in ("stop_position", "platform")
    ]

    for entrance in entrance_nodes:
        closest_dist = float("inf")
        closest_stop: Stop | None = None
        for stop in stop_nodes:
            d = manhattan_distance(
                entrance.lat, entrance.lon, stop.lat, stop.lon
            )
            if d < closest_dist:
                closest_dist = d
                closest_stop = stop
        if closest_stop is not None and closest_dist < 500:
            time_min = convert_walk_time(closest_dist)
            e = Edge(
                from_stop_id=entrance.id,
                to_stop_id=closest_stop.id,
                distance_m=closest_dist,
                travel_time_s=time_min * 60.0,
                edge_type="entrance",
            )
            session.add(e)
            # reverse edge
            e2 = Edge(
                from_stop_id=closest_stop.id,
                to_stop_id=entrance.id,
                distance_m=closest_dist,
                travel_time_s=time_min * 60.0,
                edge_type="entrance",
            )
            session.add(e2)
            stats["entrance_links"] += 1

    session.flush()
    return dict(stats)


# ── Element classifiers ──────────────────────────────────────────

def _classify_stop_type(tags: dict) -> str | None:
    """Determine stop_type from OSM tags. Returns None if not a transit stop."""
    if tags.get("public_transport") == "stop_position":
        return "stop_position"
    if tags.get("public_transport") == "platform":
        return "platform"
    if tags.get("public_transport") == "station":
        return "station"
    # Legacy tags
    if tags.get("railway") in ("stop", "station", "halt", "tram_stop"):
        return "stop_position"
    if tags.get("highway") == "bus_stop":
        return "platform"
    if tags.get("amenity") == "bus_station":
        return "station"
    if tags.get("railway") == "subway_entrance":
        return "entrance"
    return None


# ── Route import ─────────────────────────────────────────────────

def _import_route_relation(session, rel: dict, osm_to_stop: dict, stats: dict) -> None:
    """Process a ``type=route`` relation into routes, route_stops, and edges."""
    tags = rel.get("tags") or {}
    members = rel.get("members", [])

    route_type = tags.get("route", "subway")
    ref = tags.get("ref", "")
    name = tags.get("name", tags.get("description", f"Route {ref}"))
    from_name = tags.get("from", "")
    to_name = tags.get("to", "")

    r = Route(
        osm_id=rel.get("id", 0),
        ref=ref,
        name=name,
        route_type=route_type,
        colour=tags.get("colour") or tags.get("color"),
        network=tags.get("network"),
        operator=tags.get("operator"),
        from_stop=from_name,
        to_stop=to_name,
    )
    session.add(r)
    session.flush()
    stats["routes"] = stats.get("routes", 0) + 1

    # Ordered stop_positions and their corresponding geometry nodes
    ordered_stops: list[dict] = []
    for i, m in enumerate(members):
        role = m.get("role", "")
        osm_ref = m.get("ref")
        if osm_ref is None:
            continue

        # Register route_stop for stop_positions and platforms
        if role in ("stop", "stop_entry_only", "stop_exit_only",
                    "platform", "platform_entry_only", "platform_exit_only"):
            if osm_ref in osm_to_stop:
                rs = RouteStop(
                    route_id=r.id,
                    stop_id=osm_to_stop[osm_ref].id,
                    sequence=len(ordered_stops) + 1,
                    role=role,
                )
                session.add(rs)
                if role.startswith("stop"):
                    ordered_stops.append(dict(member=m, osm_ref=osm_ref, role=role, idx=i))

    # Create transit edges between consecutive stop_positions
    for i in range(len(ordered_stops) - 1):
        cur = ordered_stops[i]
        nxt = ordered_stops[i + 1]
        cur_stop = osm_to_stop[cur["osm_ref"]]
        nxt_stop = osm_to_stop[nxt["osm_ref"]]

        # Accumulate distance over intermediate way members
        cum_dist = 0.0
        for j in range(cur["idx"] + 1, nxt["idx"]):
            m = members[j]
            if m.get("type") == "way" and m.get("ref") in osm_to_stop:
                pass  # way nodes handled in pass 3

        distance = haversine_distance(
            cur_stop.lat, cur_stop.lon, nxt_stop.lat, nxt_stop.lon
        )
        time_min = (
            convert_subway_time(distance)
            if route_type == "subway"
            else convert_walk_time(distance)
        )

        e = Edge(
            from_stop_id=cur_stop.id,
            to_stop_id=nxt_stop.id,
            distance_m=distance,
            travel_time_s=time_min * 60.0,
            edge_type=route_type if route_type == "subway" else "walk",
            route_id=r.id,
        )
        session.add(e)
        stats["edges"] = stats.get("edges", 0) + 1


# ── Stop area import ─────────────────────────────────────────────

def _import_stop_area(session, rel: dict, osm_to_stop: dict, stats: dict) -> None:
    """Process a ``stop_area`` relation, linking stops and creating transfer edges."""
    tags = rel.get("tags") or {}
    members = rel.get("members", [])

    # Find representative coordinates (centroid of member stops)
    lats, lons = [], []
    area_stops: list[dict] = []

    for m in members:
        osm_ref = m.get("ref")
        if osm_ref and osm_ref in osm_to_stop:
            s = osm_to_stop[osm_ref]
            lats.append(s.lat)
            lons.append(s.lon)
            area_stops.append(dict(role=m.get("role", ""), stop=s))

    if not area_stops:
        return

    centroid_lat = sum(lats) / len(lats)
    centroid_lon = sum(lons) / len(lons)

    name = tags.get("name:en", tags.get("name", ""))
    name_en = tags.get("name:en", tags.get("name", ""))

    sa = StopArea(
        osm_id=rel.get("id", 0),
        name=name,
        name_en=name_en,
        lat=centroid_lat,
        lon=centroid_lon,
    )
    session.add(sa)
    session.flush()
    stats["stop_areas"] = stats.get("stop_areas", 0) + 1

    # Members
    for as_ in area_stops:
        m = StopAreaMember(
            stop_area_id=sa.id,
            stop_id=as_["stop"].id,
            role=as_["role"] or "stop",
        )
        session.add(m)

    # Transfer edges: connect stop_positions within the same stop_area
    stop_positions = [
        as_ for as_ in area_stops
        if as_["stop"].stop_type == "stop_position"
    ]
    for i in range(len(stop_positions)):
        for j in range(i + 1, len(stop_positions)):
            s1 = stop_positions[i]["stop"]
            s2 = stop_positions[j]["stop"]
            dist = manhattan_distance(s1.lat, s1.lon, s2.lat, s2.lon)
            time_min = convert_walk_time(dist) + 2.0  # +2 min wait time
            e1 = Edge(
                from_stop_id=s1.id,
                to_stop_id=s2.id,
                distance_m=dist,
                travel_time_s=time_min * 60.0,
                edge_type="transfer",
            )
            e2 = Edge(
                from_stop_id=s2.id,
                to_stop_id=s1.id,
                distance_m=dist,
                travel_time_s=time_min * 60.0,
                edge_type="transfer",
            )
            session.add(e1)
            session.add(e2)
            stats["edges"] = stats.get("edges", 0) + 2

    # Entrance-to-stop links
    entrances = [
        as_ for as_ in area_stops
        if as_["stop"].stop_type == "entrance"
    ]
    for entrance in entrances:
        for sp in stop_positions:
            s_ent = entrance["stop"]
            s_stop = sp["stop"]
            dist = manhattan_distance(s_ent.lat, s_ent.lon, s_stop.lat, s_stop.lon)
            time_min = convert_walk_time(dist * 1.1)
            e1 = Edge(
                from_stop_id=s_ent.id,
                to_stop_id=s_stop.id,
                distance_m=dist * 1.1,
                travel_time_s=time_min * 60.0,
                edge_type="entrance",
            )
            e2 = Edge(
                from_stop_id=s_stop.id,
                to_stop_id=s_ent.id,
                distance_m=dist * 1.1,
                travel_time_s=time_min * 60.0,
                edge_type="entrance",
            )
            session.add(e1)
            session.add(e2)
            stats["edges"] = stats.get("edges", 0) + 2


# ── Way import ───────────────────────────────────────────────────

def _import_way_edges(session, way: dict, osm_to_stop: dict, stats: dict) -> None:
    """Process a way element: create edges between consecutive geometry points.

    Only creates edges if BOTH endpoint nodes are known transit stops.
    Non-transit nodes within a way are included as intermediate geometry
    points.
    """
    nodes = way.get("nodes", [])
    geometry = way.get("geometry", [])
    tags = way.get("tags") or {}

    if len(nodes) < 2 or len(geometry) < 2:
        return

    is_subway = tags.get("railway") == "subway"

    # Find runs of consecutive nodes that are in osm_to_stop
    # Only create edges when both endpoints are known stops
    for i in range(len(nodes) - 1):
        if i + 1 >= len(geometry):
            break

        n1, n2 = nodes[i], nodes[i + 1]
        lat1, lon1 = geometry[i]["lat"], geometry[i]["lon"]
        lat2, lon2 = geometry[i + 1]["lat"], geometry[i + 1]["lon"]

        if None in (lat1, lon1, lat2, lon2):
            continue

        # Only create edge if both nodes are registered stops
        # or if this is a subway way (handles track segments)
        s1 = osm_to_stop.get(n1)
        s2 = osm_to_stop.get(n2)

        if not is_subway and (s1 is None or s2 is None):
            continue
        if is_subway and s1 is None and s2 is None:
            continue

        # Use OSM node IDs as stop database IDs when they aren't in stop registry
        # (for intermediate track nodes between stations)
        from_id = s1.id if s1 else n1
        to_id = s2.id if s2 else n2

        # Register intermediate nodes as stops if needed
        if s1 is None:
            interim = Stop(
                osm_id=n1, name="", name_en="", stop_type="stop_position",
                mode="subway", lat=lat1, lon=lon1,
            )
            session.add(interim)
            session.flush()
            from_id = interim.id
            osm_to_stop[n1] = interim
        if s2 is None:
            interim = Stop(
                osm_id=n2, name="", name_en="", stop_type="stop_position",
                mode="subway", lat=lat2, lon=lon2,
            )
            session.add(interim)
            session.flush()
            to_id = interim.id
            osm_to_stop[n2] = interim

        distance = haversine_distance(lat1, lon1, lat2, lon2)
        edge_type = "subway" if is_subway else "walk"
        time_min = (
            convert_subway_time(distance) if is_subway else convert_walk_time(distance)
        )
        way_id = way.get("id")

        e = Edge(
            from_stop_id=from_id,
            to_stop_id=to_id,
            distance_m=distance,
            travel_time_s=time_min * 60.0,
            edge_type=edge_type,
            # route_id=way_id if is_subway else None,
            route_id= None,
        )
        session.add(e)
        stats["edges"] = stats.get("edges", 0) + 1


# ── CLI ──────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Import OSM data into PostgreSQL/PostGIS")
    parser.add_argument(
        "--input", "-i",
        default="data/raw_osm_data.json",
        help="Path to OSM JSON file (default: data/raw_osm_data.json)",
    )
    parser.add_argument(
        "--clear", "-c",
        action="store_true",
        help="Truncate all routing tables before import",
    )
    args = parser.parse_args()

    stats = import_osm_to_db(args.input, clear_first=args.clear)
    print(f"\nImport statistics: {json.dumps(stats, indent=2)}")


if __name__ == "__main__":
    main()