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
from backend.routes.api_v2 import api_v2_bp
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
        static_folder="../frontend/dist",
        static_url_path="",
    )
    app.config.from_object(config[config_name])

    CORS(app)
    app.register_blueprint(api_bp)
    app.register_blueprint(api_v2_bp)

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

    Delegates to :mod:`backend.services.graph_builder` for the heavy
    lifting of reading edge/stop/route data from the database and
    constructing the in-memory graph.
    """
    from backend.services.graph_builder import build_graph_from_database

    graph = build_graph_from_database()
    tree, node_ids = build_spatial_index(graph)

    app.config["GRAPH"] = graph
    app.config["KDTREE"] = tree
    app.config["NODE_IDS"] = node_ids

    # MAP_DATA: serialize basic graph info for the frontend
    from backend.db.engine import get_session
    from backend.db.repository import get_stops_by_ids

    session = get_session()
    try:
        stop_ids = {
            nid for nid in graph.stop_map
            if isinstance(nid, int)
        } | {
            nid for nid in graph.entrance_map
            if isinstance(nid, int)
        }
        stops = get_stops_by_ids(session, stop_ids) if stop_ids else []
    finally:
        session.close()

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
            for s in stops
        ]
    }

    app.config["GRAPH_EDGES_STATIC"] = _build_static_graph_data(graph)

    logger.info("Graph loaded from database (%s).", repr(graph))


if __name__ == "__main__":
    app = create_app()
    app.run(
        host=app.config.get("HOST", "0.0.0.0"),
        port=app.config.get("PORT", 5000),
        debug=app.config.get("DEBUG", False),
    )