"""API v2 routes — enhanced endpoints with leg-based responses.

Provides richer routing results (structured legs), stop/route lookup,
admin operations with DB persistence, and a health-check endpoint.

All v1 endpoints remain in ``api.py`` for backward compatibility.
"""

from __future__ import annotations

import logging

from flask import Blueprint, current_app, jsonify, request

from backend.db.engine import get_session, is_db_enabled
from backend.db.repository import (
    block_stop as db_block_stop,
    get_all_routes,
    get_blocked_stop_ids,
    get_routes_for_stop,
    get_stop_by_id,
    get_stops_in_bbox,
    search_stops,
    unblock_all as db_unblock_all,
    unblock_stop as db_unblock_stop,
)
from backend.models.graph import SubwayGraph
from backend.models.types import LegInfo, PathResult, RoutingConstraints
from backend.services.pathfinding import find_shortest_path
from backend.utils.convert_to_time import convert_walk_time
from backend.utils.nearest_points import find_nearest_node
from backend.utils.validation import ValidationError, validate_pathfind_input

logger = logging.getLogger(__name__)

api_v2_bp = Blueprint("api_v2", __name__, url_prefix="/api/v2")


# ── Health ───────────────────────────────────────────────────────

@api_v2_bp.route("/health", methods=["GET"])
def health():
    """Health check including database connectivity status."""
    status = {
        "status": "ok",
        "database": is_db_enabled(),
    }
    if is_db_enabled():
        try:
            session = get_session()
            session.execute("SELECT 1")
            session.close()
            status["database_connected"] = True
        except Exception as exc:
            status["database_connected"] = False
            status["database_error"] = str(exc)

    graph: SubwayGraph | None = current_app.config.get("GRAPH")
    if graph:
        status["graph"] = {
            "nodes": graph.node_count,
            "edges": graph.edge_count,
            "routes": graph.route_count,
        }
    return jsonify(status)


# ── Routing (enhanced) ───────────────────────────────────────────

@api_v2_bp.route("/route", methods=["POST"])
def route():
    """Find the optimal transit route between two points.

    Request body (JSON)::

        {
            "start": [lat, lon],          # required
            "end":   [lat, lon],          # required
            "algorithm": "dijkstra",      # optional — one of:
                                          #   dijkstra, astar, transfer_aware
            "constraints": {              # optional
                "max_transfers": 3,
                "transfer_penalty_s": 180.0,
                "avoid_routes": [1, 2],
                "optimize": "time"        # "time" | "distance" | "transfers"
            },
            "include_walking": true,      # optional — include first/last mile
            "include_legs": true          # optional — include structured legs
        }

    Response (200)::

        {
            "summary": {
                "total_distance_m": 4523,
                "total_time_s": 892,
                "total_transfers": 1,
                "walking_distance_m": 340
            },
            "legs": [...],
            "path": [[lat, lon, name, type], ...]
        }
    """
    graph: SubwayGraph = current_app.config["GRAPH"]
    body = request.get_json(silent=True)

    if body is None:
        return jsonify({"error": "Request body must be JSON."}), 400

    try:
        start_coord, end_coord = validate_pathfind_input(body)
    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    if start_coord == end_coord:
        return jsonify({"error": "Start and end points must differ."}), 400

    # ── Nearest-node lookup (reuse v1 logic) ─────────────────────
    tree = current_app.config["KDTREE"]
    node_ids = current_app.config["NODE_IDS"]

    dist_start = dist_end = 0.0

    if graph.get_node_by_coord(start_coord[0], start_coord[1]) is None:
        nearest, dist_start = find_nearest_node(
            tree, node_ids, start_coord[0], start_coord[1]
        )
        if dist_start == float("inf"):
            return jsonify({"error": "No nearby node found for start point."}), 404
        start_coord = list(graph.get_coord_by_node(nearest))

    if graph.get_node_by_coord(end_coord[0], end_coord[1]) is None:
        nearest, dist_end = find_nearest_node(
            tree, node_ids, end_coord[0], end_coord[1]
        )
        if dist_end == float("inf"):
            return jsonify({"error": "No nearby node found for end point."}), 404
        end_coord = list(graph.get_coord_by_node(nearest))

    # ── Constraints ──────────────────────────────────────────────
    algo = body.get("algorithm")
    constraints_data = body.get("constraints") or {}
    constraints = RoutingConstraints(
        avoid_routes=constraints_data.get("avoid_routes", []),
        max_transfers=constraints_data.get("max_transfers"),
        transfer_penalty_s=constraints_data.get("transfer_penalty_s", 180.0),
        prefer_route_id=constraints_data.get("prefer_route_id"),
        optimize=constraints_data.get("optimize", "time"),
    )

    # ── Run routing ──────────────────────────────────────────────
    result = find_shortest_path(graph, start_coord, end_coord, algorithm=algo, constraints=constraints)

    if result is None:
        return jsonify({"error": "No route found between the selected points."}), 404

    # ── Build response ──────────────────────────────────────────
    walking_dist = dist_start + dist_end
    walking_time_s = convert_walk_time(walking_dist) * 60.0

    summary = {
        "total_distance_m": round(result.distance_meters + walking_dist, 2),
        "total_time_s": round((result.estimate_time * 60.0) + walking_time_s, 2),
        "total_transfers": result.transfers,
        "walking_distance_m": round(walking_dist, 2),
        "algorithm": result.algorithm,
    }

    response: dict = {"summary": summary, "path": result.path}

    # Build structured legs
    if body.get("include_legs", True):
        legs = _build_legs(result, graph, start_coord, end_coord, dist_start, dist_end)
        response["legs"] = legs

    return jsonify(response)


def _build_legs(
    result: PathResult,
    graph: SubwayGraph,
    start_coord: list[float],
    end_coord: list[float],
    start_walk_m: float,
    end_walk_m: float,
) -> list[dict]:
    """Decompose path into walk → transit → walk legs.

    Uses edge_meta to detect route changes and transitions between
    walking and transit segments.
    """
    legs: list[dict] = []

    # ── First-last mile walking ──────────────────────────────────
    if start_walk_m > 0:
        legs.append({
            "type": "walk",
            "from": {"lat": start_coord[0], "lon": start_coord[1], "name": None},
            "to": _format_path_point(result.path[0]) if result.path else {},
            "distance_m": round(start_walk_m, 2),
            "time_s": round(convert_walk_time(start_walk_m) * 60.0, 2),
            "geometry": [[start_coord[0], start_coord[1]]],
        })

    # ── Transit legs: group consecutive nodes by route ───────────
    if result.path:
        current_leg = None
        current_route = None

        for i, point in enumerate(result.path):
            coord, name, ntype = point
            node_id = graph.get_node_by_coord(coord[0], coord[1])

            # Determine edge meta for this segment
            route_id = None
            edge_type = "walk"
            if i < len(result.path) - 1:
                next_coord = result.path[i + 1][0]
                next_id = graph.get_node_by_coord(next_coord[0], next_coord[1])
                if node_id is not None and next_id is not None:
                    meta = graph.get_edge_meta(node_id, next_id)
                    if meta:
                        route_id = meta.route_id
                        edge_type = meta.edge_type

            route_changed = route_id != current_route and name is not None

            if route_changed or current_leg is None:
                # Finalize previous leg
                if current_leg:
                    legs.append(current_leg)

                # Start new leg
                route_info = graph.get_route_info(route_id) if route_id else None
                current_leg = {
                    "type": "transit" if route_id else edge_type,
                    "from": {"lat": coord[0], "lon": coord[1], "name": name},
                    "to": {"lat": coord[0], "lon": coord[1], "name": name},
                    "distance_m": 0.0,
                    "time_s": 0.0,
                    "route_id": route_id,
                    "route_ref": route_info.ref if route_info else None,
                    "route_name": route_info.name if route_info else None,
                    "route_colour": route_info.colour if route_info else None,
                    "intermediate_stops": [],
                    "geometry": [[coord[0], coord[1]]],
                }
                current_route = route_id
            else:
                # Extend current leg
                current_leg["to"] = {"lat": coord[0], "lon": coord[1], "name": name}
                current_leg["geometry"].append([coord[0], coord[1]])
                if name and name != current_leg["from"].get("name"):
                    current_leg["intermediate_stops"].append(name)

        if current_leg:
            # Use result totals to fill distance/time
            current_leg["distance_m"] = round(result.distance_meters, 2)
            current_leg["time_s"] = round(result.estimate_time * 60.0, 2)
            legs.append(current_leg)

    # ── Last mile ────────────────────────────────────────────────
    if end_walk_m > 0 and result.path:
        last_point = result.path[-1]
        legs.append({
            "type": "walk",
            "from": _format_path_point(last_point),
            "to": {"lat": end_coord[0], "lon": end_coord[1], "name": None},
            "distance_m": round(end_walk_m, 2),
            "time_s": round(convert_walk_time(end_walk_m) * 60.0, 2),
            "geometry": [[end_coord[0], end_coord[1]]],
        })

    return legs


def _format_path_point(point) -> dict:
    """Format a path tuple into a dict."""
    coord, name, ntype = point
    return {"lat": coord[0], "lon": coord[1], "name": name}


# ── Stop Lookup ──────────────────────────────────────────────────

@api_v2_bp.route("/stops", methods=["GET"])
def stops():
    """List/search stops.

    Query params:
        name (str): Case-insensitive name search.
        type (str): Filter by stop_type (stop_position, platform, entrance).
        mode (str): Filter by mode (subway, bus, tram).
        min_lat, min_lon, max_lat, max_lon (float): Bounding box filter.
        limit (int): Max results (default 50).
    """
    if not is_db_enabled():
        return jsonify({"error": "Database not enabled. Set USE_DATABASE=true."}), 503

    session = get_session()
    try:
        name = request.args.get("name", "")
        stop_type = request.args.get("type")
        mode = request.args.get("mode")

        min_lat = request.args.get("min_lat", type=float)
        max_lat = request.args.get("max_lat", type=float)
        min_lon = request.args.get("min_lon", type=float)
        max_lon = request.args.get("max_lon", type=float)
        limit = request.args.get("limit", 50, type=int)

        if all(x is not None for x in (min_lat, max_lat, min_lon, max_lon)):
            results = get_stops_in_bbox(session, min_lat, min_lon, max_lat, max_lon, limit)
        else:
            results = search_stops(session, name=name, stop_type=stop_type, mode=mode, limit=limit)

        return jsonify({
            "count": len(results),
            "stops": [
                {
                    "id": s.id,
                    "osm_id": s.osm_id,
                    "name": s.name_en or s.name,
                    "type": s.stop_type,
                    "mode": s.mode,
                    "lat": s.lat,
                    "lon": s.lon,
                }
                for s in results
            ],
        })
    finally:
        session.close()


@api_v2_bp.route("/stops/<int:stop_id>", methods=["GET"])
def stop_detail(stop_id: int):
    """Get details for a single stop, including served routes."""
    if not is_db_enabled():
        return jsonify({"error": "Database not enabled."}), 503

    session = get_session()
    try:
        stop = get_stop_by_id(session, stop_id)
        if stop is None:
            return jsonify({"error": f"Stop {stop_id} not found."}), 404

        routes = get_routes_for_stop(session, stop_id)
        return jsonify({
            "id": stop.id,
            "osm_id": stop.osm_id,
            "name": stop.name_en or stop.name,
            "type": stop.stop_type,
            "mode": stop.mode,
            "lat": stop.lat,
            "lon": stop.lon,
            "wheelchair": stop.wheelchair,
            "routes": [
                {
                    "id": r.id,
                    "ref": r.ref,
                    "name": r.name,
                    "type": r.route_type,
                    "colour": r.colour,
                }
                for r in routes
            ],
        })
    finally:
        session.close()


# ── Route Lookup ─────────────────────────────────────────────────

@api_v2_bp.route("/routes", methods=["GET"])
def routes():
    """List transit routes.

    Query params:
        type (str): Filter by route_type (subway, bus, tram).
        limit (int): Max results (default 200).
    """
    if not is_db_enabled():
        return jsonify({"error": "Database not enabled."}), 503

    session = get_session()
    try:
        route_type = request.args.get("type")
        limit = request.args.get("limit", 200, type=int)

        results = get_all_routes(session, route_type=route_type, limit=limit)
        return jsonify({
            "count": len(results),
            "routes": [
                {
                    "id": r.id,
                    "osm_id": r.osm_id,
                    "ref": r.ref,
                    "name": r.name,
                    "type": r.route_type,
                    "colour": r.colour,
                    "network": r.network,
                    "operator": r.operator,
                    "from": r.from_stop,
                    "to": r.to_stop,
                }
                for r in results
            ],
        })
    finally:
        session.close()


@api_v2_bp.route("/routes/<int:route_id>", methods=["GET"])
def route_detail(route_id: int):
    """Get a single route with full geometry and ordered stops."""
    if not is_db_enabled():
        return jsonify({"error": "Database not enabled."}), 503

    from backend.db.repository import get_route_by_id, get_route_stops

    session = get_session()
    try:
        route = get_route_by_id(session, route_id)
        if route is None:
            return jsonify({"error": f"Route {route_id} not found."}), 404

        stops = get_route_stops(session, route_id)
        return jsonify({
            "id": route.id,
            "osm_id": route.osm_id,
            "ref": route.ref,
            "name": route.name,
            "type": route.route_type,
            "colour": route.colour,
            "network": route.network,
            "operator": route.operator,
            "from": route.from_stop,
            "to": route.to_stop,
            "stops": [
                {
                    "stop_id": rs.stop_id,
                    "name": rs.stop.name_en or rs.stop.name,
                    "sequence": rs.sequence,
                    "role": rs.role,
                    "lat": rs.stop.lat,
                    "lon": rs.stop.lon,
                }
                for rs in stops
            ],
        })
    finally:
        session.close()


# ── Admin Operations (DB-persisted) ──────────────────────────────

@api_v2_bp.route("/admin/block", methods=["POST"])
def admin_block():
    """Block or unblock a stop (persisted to database).

    Request body::

        { "stop_id": 123, "reason": "Maintenance" }

    If *stop_id* is already blocked, this unblocks it.
    If *reason* is omitted, "Manual block" is used.
    """
    if not is_db_enabled():
        return jsonify({"error": "Database not enabled."}), 503

    body = request.get_json(silent=True)
    if body is None:
        return jsonify({"error": "Request body must be JSON."}), 400

    stop_id = body.get("stop_id")
    if stop_id is None:
        return jsonify({"error": "Missing 'stop_id'."}), 400

    session = get_session()
    try:
        currently_blocked = get_blocked_stop_ids(session)
        if stop_id in currently_blocked:
            db_unblock_stop(session, stop_id)
            action = "unblocked"
        else:
            reason = body.get("reason", "Manual block")
            db_block_stop(session, stop_id, reason=reason)
            action = "blocked"

        # Sync in-memory graph state
        graph: SubwayGraph = current_app.config["GRAPH"]
        if graph:
            graph.blocked_node[stop_id] = (action == "blocked")

        return jsonify({"stop_id": stop_id, "action": action})
    finally:
        session.close()


@api_v2_bp.route("/admin/unblock-all", methods=["POST"])
def admin_unblock_all():
    """Remove all blocked stops."""
    if not is_db_enabled():
        return jsonify({"error": "Database not enabled."}), 503

    session = get_session()
    try:
        count = db_unblock_all(session)

        # Sync in-memory graph
        graph: SubwayGraph = current_app.config["GRAPH"]
        if graph:
            graph.blocked_node.clear()

        return jsonify({"unblocked_count": count})
    finally:
        session.close()


# ── Graph data (reuse v1 logic) ──────────────────────────────────

@api_v2_bp.route("/graph", methods=["GET"])
def graph_edges():
    """Return graph edges with edge-type and route metadata."""
    from backend.routes.api import _build_static_graph_data as _build_data

    graph: SubwayGraph = current_app.config.get("GRAPH")
    if not graph:
        return jsonify({"error": "Graph not loaded."}), 500

    static = current_app.config.get("GRAPH_EDGES_STATIC")
    if static is None:
        static = _build_data(graph)
        current_app.config["GRAPH_EDGES_STATIC"] = static

    blocked_nodes = [
        node_id for node_id, blocked in graph.blocked_node.items() if blocked
    ]

    # Add edge-type info from edge_meta
    edges_with_type = []
    for edge in static["edges"]:
        meta = graph.get_edge_meta(edge["from"], edge["to"])
        edges_with_type.append({
            **edge,
            "edge_type": meta.edge_type if meta else "unknown",
            "route_id": meta.route_id if meta else None,
        })

    return jsonify({
        "edges": edges_with_type,
        "nodes": static["nodes"],
        "node_ways": static.get("node_ways", {}),
        "blocked_nodes": blocked_nodes,
        "blocked_track_nodes": [],
    })