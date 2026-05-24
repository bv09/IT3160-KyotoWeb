"""App factory — Tạo và cấu hình Flask app."""

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

    data_file = app.config.get("DATA_FILE")
    if data_file:
        try:
            # Load graph
            graph = load_graph(data_file)
            app.config["GRAPH"] = graph
            Tree, node_ids = build_spatial_index(graph)
            app.config["KDTREE"] = Tree
            app.config["NODE_IDS"] = node_ids

            # TỐI ƯU: Cache map-data (file JSON) 1 lần lúc startup
            with open(data_file, "r", encoding="utf-8") as f:
                app.config["MAP_DATA"] = json.load(f)
            logger.info("MAP_DATA đã được cache.")

            # TỐI ƯU: Cache phần tĩnh của graph-edges 1 lần lúc startup
            app.config["GRAPH_EDGES_STATIC"] = _build_static_graph_data(graph)
            logger.info(
                "GRAPH_EDGES_STATIC đã được cache (%d edges, %d nodes).",
                len(app.config["GRAPH_EDGES_STATIC"]["edges"]),
                len(app.config["GRAPH_EDGES_STATIC"]["nodes"]),
            )

            logger.info("Đồ thị đã được load thành công.")
        except FileNotFoundError as e:
            logger.error(str(e))
            raise
    else:
        logger.info("DATA_FILE không được cấu hình (chế độ testing?).")

    @app.route("/")
    def index():
        return app.send_static_file("index.html")

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(
        host=app.config.get("HOST", "0.0.0.0"),
        port=app.config.get("PORT", 5000),
        debug=app.config.get("DEBUG", False),
    )