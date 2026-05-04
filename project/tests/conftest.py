"""Shared fixtures cho test suite."""

import pytest

from backend.app import create_app
from backend.models.graph import SubwayGraph
from backend.services.osm_loader import load_graph


@pytest.fixture
def small_osm_data():
    """Dữ liệu OSM nhỏ (~6 nodes) để test mà không cần file 50MB.

    Mạng lưới giả:
        A(1) --100m-- B(2) --150m-- C(3)
                       |
                      200m
                       |
                      D(4) --80m-- E(5) --120m-- F(6)

    Node 2 (B) và Node 4 (D) là điểm dừng có tên.
    Way 101: A→B→C (hai chiều)
    Way 102: B→D (hai chiều)
    Way 103: D→E→F (một chiều)
    """
    return {
        "elements": [
            # Stop nodes (railway=stop)
            {
                "type": "node",
                "id": 2,
                "lat": 35.0100,
                "lon": 135.7700,
                "tags": {"railway": "stop", "name:en": "Station B", "name": "駅B"},
            },
            {
                "type": "node",
                "id": 4,
                "lat": 35.0080,
                "lon": 135.7700,
                "tags": {"railway": "stop", "name:en": "Station D", "name": "駅D"},
            },
            # Way 101: A → B → C (two-way)
            {
                "type": "way",
                "id": 101,
                "tags": {"railway": "rail"},
                "nodes": [1, 2, 3],
                "geometry": [
                    {"lat": 35.0100, "lon": 135.7680},
                    {"lat": 35.0100, "lon": 135.7700},
                    {"lat": 35.0100, "lon": 135.7720},
                ],
            },
            # Way 102: B → D (two-way)
            {
                "type": "way",
                "id": 102,
                "tags": {"railway": "rail"},
                "nodes": [2, 4],
                "geometry": [
                    {"lat": 35.0100, "lon": 135.7700},
                    {"lat": 35.0080, "lon": 135.7700},
                ],
            },
            # Way 103: D → E → F (one-way)
            {
                "type": "way",
                "id": 103,
                "tags": {"railway": "rail", "oneway": "yes"},
                "nodes": [4, 5, 6],
                "geometry": [
                    {"lat": 35.0080, "lon": 135.7700},
                    {"lat": 35.0080, "lon": 135.7710},
                    {"lat": 35.0080, "lon": 135.7725},
                ],
            },
        ]
    }


@pytest.fixture
def test_graph(small_osm_data):
    """SubwayGraph gebouwd uit de kleine testdata."""
    from backend.services.osm_loader import _build_graph

    return _build_graph(small_osm_data)


@pytest.fixture
def app(test_graph):
    """Flask test app met ingeladen testgraph."""
    application = create_app("testing")
    application.config["GRAPH"] = test_graph
    application.config["DATA_FILE"] = None
    return application


@pytest.fixture
def client(app):
    """Flask test client."""
    return app.test_client()
