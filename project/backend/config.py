"""Application configuration per environment (development / production / testing)."""

import os


class BaseConfig:
    """Common configuration for all environments."""

    DATA_FILE = os.environ.get("DATA_FILE", "data/raw_osm_data.json")
    HOST = os.environ.get("HOST", "0.0.0.0")
    PORT = int(os.environ.get("PORT", 5010))

    # Database mode — set USE_DATABASE=true to enable PostgreSQL/PostGIS
    DATABASE_URL = os.environ.get(
        "DATABASE_URL",
        "postgresql://kyoto:password@localhost:5432/kyoto_transit",
    )
    USE_DATABASE = (
        os.environ.get("USE_DATABASE", "false").lower() == "true"
    )

    # External routing
    ORS_TOKEN = os.environ.get("ORS_TOKEN", "")
    OSRM_URL = os.environ.get("OSRM_URL", "")
    WALKING_ENGINE = os.environ.get("WALKING_ENGINE", "internal")  # "internal" | "osrm" | "ors"


class DevelopmentConfig(BaseConfig):
    """Cấu hình cho môi trường phát triển."""
    DEBUG = True


class ProductionConfig(BaseConfig):
    """Cấu hình cho môi trường production."""
    DEBUG = False


class TestingConfig(BaseConfig):
    """Cấu hình cho môi trường chạy test."""
    TESTING = True
    DEBUG = False
    DATA_FILE = None  # Tests cung cấp dữ liệu riêng


config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}
