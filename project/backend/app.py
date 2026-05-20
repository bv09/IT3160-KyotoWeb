"""App factory — Tạo và cấu hình Flask app.

Sử dụng pattern app factory để:
- Hỗ trợ nhiều cấu hình (dev/prod/test)
- Đồ thị được lưu trên app.config thay vì biến global
- Hoạt động đúng với gunicorn (production WSGI)
"""

import logging
import os

from flask import Flask
from flask_cors import CORS

from backend.config import config
from backend.routes.api import api_bp
from backend.services.osm_loader import load_graph
from backend.utils.nearest_points import build_spatial_index

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def create_app(config_name: str | None = None) -> Flask:
    """Tạo Flask app với cấu hình cho môi trường chỉ định.

    Args:
        config_name: Tên môi trường ("development", "production", "testing").
                     Mặc định đọc từ biến FLASK_ENV, fallback về "development".

    Returns:
        Flask app đã cấu hình và sẵn sàng chạy.
    """
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "development")

    app = Flask(
        __name__,
        static_folder="../frontend",
        static_url_path="",
    )
    app.config.from_object(config[config_name])

    CORS(app)

    # Đăng ký blueprint API
    app.register_blueprint(api_bp)

    # Load đồ thị khi khởi động (trừ khi đang test)
    data_file = app.config.get("DATA_FILE")
    if data_file:
        try:
            graph = load_graph(data_file)
            app.config["GRAPH"] = graph
            Tree, node_ids = build_spatial_index(graph)
            app.config["KDTREE"] = Tree
            app.config["NODE_IDS"] = node_ids
            logger.info("Đồ thị đã được load thành công.")
        except FileNotFoundError as e:
            logger.error(str(e))
            raise
    else:
        logger.info("DATA_FILE không được cấu hình (chế độ testing?).")

    # Serve frontend
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
