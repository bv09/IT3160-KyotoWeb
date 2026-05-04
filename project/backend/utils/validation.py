"""Kiểm tra và validate dữ liệu đầu vào từ API request."""


class ValidationError(Exception):
    """Lỗi khi dữ liệu đầu vào không hợp lệ."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(self.message)


def validate_pathfind_input(data: dict) -> tuple[list[float], list[float]]:
    """Validate dữ liệu đầu vào cho endpoint tìm đường.

    Args:
        data: JSON body từ request, cần có 'start' và 'end'.

    Returns:
        Tuple (start_coord, end_coord), mỗi phần tử là [lat, lon].

    Raises:
        ValidationError: Khi dữ liệu không hợp lệ.
    """
    if not isinstance(data, dict):
        raise ValidationError("Request body phải là JSON object.")

    for key in ("start", "end"):
        if key not in data:
            raise ValidationError(f"Thiếu trường '{key}' trong request.")

        coord = data[key]
        if not isinstance(coord, (list, tuple)) or len(coord) != 2:
            raise ValidationError(
                f"Trường '{key}' phải là mảng 2 phần tử [lat, lon]."
            )

        lat, lon = coord
        if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
            raise ValidationError(
                f"Tọa độ '{key}' phải là số (lat, lon)."
            )

        if not (-90 <= lat <= 90):
            raise ValidationError(
                f"Latitude của '{key}' phải nằm trong khoảng [-90, 90]. Nhận: {lat}"
            )

        if not (-180 <= lon <= 180):
            raise ValidationError(
                f"Longitude của '{key}' phải nằm trong khoảng [-180, 180]. Nhận: {lon}"
            )

    return data["start"], data["end"]
