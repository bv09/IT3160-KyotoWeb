"""Script tải dữ liệu đường sắt Kyoto từ Overpass API.

Sử dụng exponential backoff khi gặp lỗi mạng,
thay vì retry vô hạn như phiên bản cũ.
"""

import json
import logging
import time
from collections import Counter
from pathlib import Path

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Mặc định lưu vào thư mục data/ ở gốc project
DEFAULT_OUTPUT = "data/raw_osm_data.json"

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

QUERY = """
    
    
"""

HEADERS = {"User-Agent": "KyotoPathfindingApp/1.0 (HUST Student Project)"}

MAX_RETRIES = 5
INITIAL_BACKOFF = 2  # seconds


def fetch_and_save_osm_data(output_path: str = DEFAULT_OUTPUT) -> None:
    """Tải dữ liệu Kyoto từ Overpass API và lưu vào file JSON.

    Args:
        output_path: Đường dẫn file JSON đầu ra.

    Raises:
        requests.exceptions.RequestException: Sau khi đã retry MAX_RETRIES lần.
    """
    # Đảm bảo thư mục cha tồn tại
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    backoff = INITIAL_BACKOFF

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.info(
                "Đang gọi Overpass API (lần thử %d/%d)...", attempt, MAX_RETRIES
            )

            response = requests.post(
                OVERPASS_URL,
                headers=HEADERS,
                data={"data": QUERY},
                timeout=90,
            )
            response.raise_for_status()
            data = response.json()

            # Thống kê phần tử
            _log_statistics(data)

            # Lưu file JSON
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=4)

            logger.info("Đã lưu dữ liệu vào: %s", output_path)
            return

        except requests.exceptions.RequestException as error:
            logger.warning("Lỗi lần thử %d: %s", attempt, error)
            if attempt < MAX_RETRIES:
                logger.info("Chờ %ds trước khi thử lại...", backoff)
                time.sleep(backoff)
                backoff *= 2  # Exponential backoff
            else:
                logger.error("Đã hết số lần thử lại (%d).", MAX_RETRIES)
                raise


def _log_statistics(data: dict) -> None:
    """Log thống kê số lượng phần tử trong dữ liệu OSM."""
    elements = data.get("elements", [])
    counter = Counter()

    for element in elements:
        counter[element.get("type", "unknown")] += 1
        if element.get("type") == "node" and "tags" in element:
            railway = element["tags"].get("railway")
            if railway:
                counter[f"railway_{railway}"] += 1

    logger.info("Tải thành công %d phần tử từ OSM.", len(elements))
    logger.info(
        "  Nodes: %d, Ways: %d, Relations: %d",
        counter.get("node", 0),
        counter.get("way", 0),
        counter.get("relation", 0),
    )
    logger.info(
        "  Stations: %d, Stops: %d",
        counter.get("railway_station", 0),
        counter.get("railway_stop", 0),
    )


if __name__ == "__main__":
    fetch_and_save_osm_data()
