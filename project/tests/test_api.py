"""Tests cho API endpoints."""

import json


class TestPathfindEndpoint:

    def test_valid_pathfind_returns_200(self, client, test_graph):
        """POST /api/v1/pathfind với tọa độ hợp lệ → 200."""
        response = client.post(
            "/api/v1/pathfind",
            data=json.dumps({
                "start": [35.0100, 135.7680],
                "end": [35.0100, 135.7700],
            }),
            content_type="application/json",
        )
        assert response.status_code == 200
        data = response.get_json()
        assert "path" in data
        assert "distance_meters" in data
        assert data["distance_meters"] > 0

    def test_no_path_returns_404(self, client, test_graph):
        """POST /api/v1/pathfind khi không có đường → 404."""
        response = client.post(
            "/api/v1/pathfind",
            data=json.dumps({
                "start": [0.0, 0.0],  # Không tồn tại trong graph
                "end": [1.0, 1.0],
            }),
            content_type="application/json",
        )
        assert response.status_code == 404

    def test_invalid_input_returns_400(self, client):
        """POST /api/v1/pathfind với dữ liệu thiếu → 400."""
        response = client.post(
            "/api/v1/pathfind",
            data=json.dumps({"start": [35.0, 135.0]}),  # Thiếu 'end'
            content_type="application/json",
        )
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data

    def test_no_json_body_returns_400(self, client):
        """POST /api/v1/pathfind không có body → 400."""
        response = client.post("/api/v1/pathfind")
        assert response.status_code == 400

    def test_lat_out_of_range_returns_400(self, client):
        """POST /api/v1/pathfind với latitude > 90 → 400."""
        response = client.post(
            "/api/v1/pathfind",
            data=json.dumps({"start": [999, 135.0], "end": [35.0, 135.0]}),
            content_type="application/json",
        )
        assert response.status_code == 400


class TestLegacyEndpoints:

    def test_legacy_save_input(self, client, test_graph):
        """POST /save_input (legacy) vẫn hoạt động."""
        response = client.post(
            "/save_input",
            data=json.dumps({
                "start": [35.0100, 135.7680],
                "end": [35.0100, 135.7700],
            }),
            content_type="application/json",
        )
        assert response.status_code == 200
        data = response.get_json()
        # Legacy format: list of [[lat, lon], stop_name]
        assert isinstance(data, list)

    def test_legacy_save_input_no_path(self, client, test_graph):
        """POST /save_input khi không tìm được đường → 404."""
        response = client.post(
            "/save_input",
            data=json.dumps({
                "start": [0.0, 0.0],
                "end": [1.0, 1.0],
            }),
            content_type="application/json",
        )
        assert response.status_code == 404
