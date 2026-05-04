"""Tests cho input validation."""

import pytest

from backend.utils.validation import ValidationError, validate_pathfind_input


class TestValidatePathfindInput:

    def test_valid_input(self):
        """Dữ liệu hợp lệ trả về đúng tọa độ."""
        start, end = validate_pathfind_input({
            "start": [35.0, 135.0],
            "end": [35.1, 135.1],
        })
        assert start == [35.0, 135.0]
        assert end == [35.1, 135.1]

    def test_missing_start(self):
        """Thiếu trường 'start' → ValidationError."""
        with pytest.raises(ValidationError, match="start"):
            validate_pathfind_input({"end": [35.0, 135.0]})

    def test_missing_end(self):
        """Thiếu trường 'end' → ValidationError."""
        with pytest.raises(ValidationError, match="end"):
            validate_pathfind_input({"start": [35.0, 135.0]})

    def test_not_dict(self):
        """Input không phải dict → ValidationError."""
        with pytest.raises(ValidationError):
            validate_pathfind_input("invalid")

    def test_coord_not_list(self):
        """Tọa độ không phải list → ValidationError."""
        with pytest.raises(ValidationError):
            validate_pathfind_input({"start": "invalid", "end": [35.0, 135.0]})

    def test_coord_wrong_length(self):
        """Tọa độ không đủ 2 phần tử → ValidationError."""
        with pytest.raises(ValidationError):
            validate_pathfind_input({"start": [35.0], "end": [35.0, 135.0]})

    def test_coord_not_number(self):
        """Tọa độ không phải số → ValidationError."""
        with pytest.raises(ValidationError):
            validate_pathfind_input({"start": ["a", "b"], "end": [35.0, 135.0]})

    def test_latitude_out_of_range(self):
        """Latitude ngoài [-90, 90] → ValidationError."""
        with pytest.raises(ValidationError, match="Latitude"):
            validate_pathfind_input({"start": [91.0, 135.0], "end": [35.0, 135.0]})

    def test_longitude_out_of_range(self):
        """Longitude ngoài [-180, 180] → ValidationError."""
        with pytest.raises(ValidationError, match="Longitude"):
            validate_pathfind_input({"start": [35.0, 181.0], "end": [35.0, 135.0]})

    def test_integer_coords_accepted(self):
        """Tọa độ dạng int cũng được chấp nhận."""
        start, end = validate_pathfind_input({
            "start": [35, 135],
            "end": [36, 136],
        })
        assert start == [35, 135]

    def test_boundary_values(self):
        """Giá trị biên [-90, 90] và [-180, 180] hợp lệ."""
        start, end = validate_pathfind_input({
            "start": [-90, -180],
            "end": [90, 180],
        })
        assert start == [-90, -180]
        assert end == [90, 180]
