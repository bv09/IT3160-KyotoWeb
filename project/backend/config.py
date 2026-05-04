"""Cấu hình ứng dụng theo môi trường (development / production / testing)."""

import os


class BaseConfig:
    """Cấu hình chung cho tất cả môi trường."""
    DATA_FILE = os.environ.get("DATA_FILE", "data/raw_osm_data.json")
    HOST = os.environ.get("HOST", "0.0.0.0")
    PORT = int(os.environ.get("PORT", 5010))


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
