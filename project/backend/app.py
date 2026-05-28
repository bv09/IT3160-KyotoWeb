"""App factory — creates and configures the Flask application.

Supports two data back-ends:

* **JSON file** (current / default): loads ``raw_osm_data.json`` into
  an in-memory ``SubwayGraph`` at startup.  Config keys: ``DATA_FILE``,
  ``USE_DATABASE=false``.
* **PostgreSQL/PostGIS** (new): when ``USE_DATABASE=true``, connects to
  the database and materializes the graph from the ``edges`` table.
"""

import json
import logging
import os

from flask import Flask
from flask_cors import CORS

from backend.config import config
from backend.routes.api import api_bp, _build_static_graph_data
from backend.services.osm_loader import load_graph
from backend.utils.nearest_points import build_spatial_index

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def create_app(config_name: str | None = None) -> Flask:
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "development")

    app = Flask(
        __name__,
        static_folder="../frontend",
        static_url_path="",
    )
    app.config.from_object(config[config_name])

    CORS(app)
    app.register_blueprint(api_bp)

    use_db = app.config.get("USE_DATABASE", False)

    if use_db:
        _init_from_database(app)
    else:
        _init_from_json_file(app)

    @app.route("/")
    def index():
        return app.send_static_file("index.html")

    return app


def _init_from_json_file(app: Flask) -> None:
    """Load graph and spatial index from a JSON data file."""
    data_file = app.config.get("DATA_FILE")
    if not data_file:
        logger.info("DATA_FILE not configured (testing mode?).")
        return

    try:
        graph = load_graph(data_file)
        app.config["GRAPH"] = graph
        tree, node_ids = build_spatial_index(graph)
        app.config["KDTREE"] = tree
        app.config["NODE_IDS"] = node_ids

        with open(data_file, "r", encoding="utf-8") as f:
            app.config["MAP_DATA"] = json.load(f)
        logger.info("MAP_DATA cached from JSON.")

        app.config["GRAPH_EDGES_STATIC"] = _build_static_graph_data(graph)
        logger.info(
            "GRAPH_EDGES_STATIC cached (%d edges, %d nodes).",
            len(app.config["GRAPH_EDGES_STATIC"]["edges"]),
            len(app.config["GRAPH_EDGES_STATIC"]["nodes"]),
        )

        logger.info("Graph loaded from JSON file (%s).", repr(graph))
    except FileNotFoundError as e:
        logger.error(str(e))
        raise


def _init_from_database(app: Flask) -> None:
    """Load graph and spatial index from PostgreSQL/PostGIS.

    Reads the ``edges``, ``stops``, and ``routes`` tables, builds the
    in-memory ``SubwayGraph``, and materializes the KDTree spatial index.
    """
    from backend.db.engine import get_session
    from backend.db.repository import (
        get_all_edges,
        get_all_routes,
        get_blocked_stop_ids,
        get_route_stops,
        get_stops_by_ids,
    )
    from backend.models.graph import RouteInfo, SubwayGraph
    from backend.utils.convert_to_time import convert_walk_time

    session = get_session()
    try:
        # ── Build graph ──────────────────────────────────────────
        graph = SubwayGraph()

        # Load stops
        edges = get_all_edges(session)
        from_ids = {e.from_id for e in edges}
        to_ids = {e.to_id for e in edges}
        all_stop_ids = from_ids | to_ids
        stops = get_stops_by_ids(session, all_stop_ids)
        stop_by_id = {s.id: s for s in stops}

        for s in stops:
            graph.register_node_coord(s.id, s.lat, s.lon)
            if s.stop_type == "stop_position":
                graph.register_stop(s.id, s.lat, s.lon, s.name_en or s.name)
            elif s.stop_type == "entrance":
                graph.register_entrance(s.id, s.lat, s.lon, s.name_en or s.name)

        # Load edges
        for e in edges:
            time_min = e.travel_time_s / 60.0
            if e.edge_type == "subway":
                graph.add_edge(
                    e.from_id, e.to_id, e.distance_m, time_min,
                    edge_type=e.edge_type, route_id=e.route_id,
                )
            else:
                graph.add_undirected_edge(
                    e.from_id, e.to_id, e.distance_m, time_min,
                    edge_type=e.edge_type,
                )

            if e.route_id is not None:
                graph.register_way(e.from_id, e.route_id)
                graph.register_way(e.to_id, e.route_id)

        # Load routes
        routes = get_all_routes(session)
        for r in routes:
            graph.register_route(r.id, RouteInfo(
                osm_id=r.osm_id,
                ref=r.ref,
                name=r.name,
                route_type=r.route_type,
                colour=r.colour,
                network=r.network,
                operator=r.operator,
                from_stop=r.from_stop,
                to_stop=r.to_stop,
            ))
            # Populate stop_routes map
            route_stops = get_route_stops(session, r.id)
            for rs in route_stops:
                graph.register_stop_route(rs.stop_id, r.id)

        # Load blocked stops
        blocked_ids = get_blocked_stop_ids(session)
        for bid in blocked_ids:
            graph.blocked_node[bid] = True

        # ── Build spatial index ──────────────────────────────────
        tree, node_ids = build_spatial_index(graph)

        app.config["GRAPH"] = graph
        app.config["KDTREE"] = tree
        app.config["NODE_IDS"] = node_ids

        # MAP_DATA: serialize basic graph info for the frontend
        app.config["MAP_DATA"] = {
            "elements": [
                {
                    "type": "node",
                    "id": s.id,
                    "lat": s.lat,
                    "lon": s.lon,
                    "tags": {
                        "name": s.name_en or s.name,
                        "railway": "stop" if s.stop_type == "stop_position" else "subway_entrance",
                    },
                }
                for s in stop_by_id.values()
            ]
        }

        app.config["GRAPH_EDGES_STATIC"] = _build_static_graph_data(graph)

        logger.info(
            "Graph loaded from database (%s), %d routes.",
            repr(graph),
            len(routes),
        )
    finally:
        session.close()


if __name__ == "__main__":
    app = create_app()
    app.run(
        host=app.config.get("HOST", "0.0.0.0"),
        port=app.config.get("PORT", 5000),
        debug=app.config.get("DEBUG", False),
    )