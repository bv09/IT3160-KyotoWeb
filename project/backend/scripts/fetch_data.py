"""Fetch Kyoto transit data from the Overpass API.

Queries for the full OSM Public Transport Schema: subway, bus, and tram
routes with stop positions, platforms, station entrances, stop_area
relations, and pedestrian ways for walking segments.

Uses exponential backoff on network errors.
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

DEFAULT_OUTPUT = "data/raw_osm_data.json"
DEFAULT_OUTPUT_V2 = "data/raw_osm_data_v2.json"

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# ── Legacy query (v1, subway‑only) ─────────────────────────────────
QUERY = """
    [out:json][timeout:180];
    area[name="京都市"][admin_level="7"]->.kyoto;

    // Tuyến tàu
    relation[route~"subway"](area.kyoto)->.routes;
    .routes out geom;

    // Stops từ relation
    node(r.routes)(area.kyoto)->.stops;
    .stops out geom;

    // Ways tuyến tàu
    way(r.routes)(area.kyoto);
    out geom;

    // Station riêng
    node[railway = "station"][station = 'subway'](area.kyoto)->.subway_stations;
    .subway_stations out geom;

    // stop_area relation — chứa mapping entrance <-> station
    relation[type="public_transport"]
            [public_transport="stop_area"]
            (bn.subway_stations)
            (area.kyoto)->.stop_areas;
    .stop_areas out geom;

    // Entrances quanh stops
    node(around.stops : 150)[railway=subway_entrance]->.entrances;
    .entrances out geom;

    // Đường đi bộ
    way[highway~"footway|pedestrian|path|sidewalk|steps|corridor|residential|living//street|service|unclassified|tertiary|secondary|primary|track|alley"]
    [access!~"no|private"]
    (area.kyoto);
    out geom;
"""

# ── Enhanced query (v2, full OSM PT schema) ────────────────────────
QUERY_V2 = """
    [out:json][timeout:300];
    area[name="京都市"][admin_level="7"]->.kyoto;

    // ── All transit routes (subway, bus, tram) ─────────────────────
    relation[route~"subway|bus|tram|train|light_rail"](area.kyoto)->.routes;
    .routes out geom;

    // ── Route master relations ─────────────────────────────────────
    relation[route_master~"subway|bus|tram|train|light_rail"](area.kyoto);
    out body;

    // ── Stop positions referenced by routes ────────────────────────
    node(r.routes)[public_transport=stop_position](area.kyoto);
    out body geom;

    // ── Platforms referenced by routes ─────────────────────────────
    way(r.routes)[public_transport=platform](area.kyoto);
    out body geom;
    node(r.routes)[public_transport=platform](area.kyoto);
    out body geom;

    // ── Legacy railway stop/station tags ───────────────────────────
    node[railway~"stop|station|halt|tram_stop"](area.kyoto)->.legacy_stops;
    .legacy_stops out body geom;

    // ── stop_area relations ────────────────────────────────────────
    relation[type="public_transport"]
            [public_transport="stop_area"]
            (area.kyoto)->.stop_areas;
    .stop_areas out body geom;

    // ── Subway entrances ───────────────────────────────────────────
    node[railway=subway_entrance](area.kyoto);
    out body geom;

    // ── Pedestrian network (for first/last mile walking) ──────────
    way[highway~"footway|pedestrian|path|steps|residential|living_street|service|unclassified|tertiary|secondary|primary"]
       [access!~"no|private"]
       (area.kyoto);
    out geom;
"""

HEADERS = {"User-Agent": "KyotoPathfindingApp/2.0 (HUST Student Project)"}

MAX_RETRIES = 5
INITIAL_BACKOFF = 2  # seconds


def _fetch(query: str, output_path: str) -> None:
    """Post *query* to Overpass and save result to *output_path*."""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.info("Overpass request attempt %d/%d ...", attempt, MAX_RETRIES)

            response = requests.post(
                OVERPASS_URL,
                headers=HEADERS,
                data={"data": query},
                timeout=90,
            )
            response.raise_for_status()
            data = response.json()

            _log_statistics(data)

            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=4)

            logger.info("Saved to: %s", output_path)
            return

        except requests.exceptions.RequestException as error:
            logger.warning("Error on attempt %d: %s", attempt, error)
            if attempt < MAX_RETRIES:
                logger.info("Waiting %ds before retry...", backoff := INITIAL_BACKOFF)
                time.sleep(backoff)
            else:
                logger.error("Max retries (%d) exhausted.", MAX_RETRIES)
                raise


def fetch_and_save_osm_data(output_path: str = DEFAULT_OUTPUT) -> None:
    """Fetch Kyoto transit data using the legacy (subway-only) query."""
    _fetch(QUERY, output_path)


def fetch_and_save_osm_data_v2(output_path: str = DEFAULT_OUTPUT_V2) -> None:
    """Fetch Kyoto transit data using the enhanced (full PT schema) query."""
    _fetch(QUERY_V2, output_path)


def _log_statistics(data: dict) -> None:
    """Log summary statistics about the fetched OSM data."""
    elements = data.get("elements", [])
    counter: Counter = Counter()

    for element in elements:
        counter[element.get("type", "unknown")] += 1
        if element.get("type") == "node" and "tags" in element:
            tags = element["tags"]
            railway = tags.get("railway")
            if railway:
                counter[f"railway_{railway}"] += 1
            pt = tags.get("public_transport")
            if pt:
                counter[f"pt_{pt}"] += 1
        if element.get("type") == "relation" and "tags" in element:
            t = element["tags"]
            if t.get("type") == "route":
                counter["route_relations"] += 1
            if t.get("public_transport") == "stop_area":
                counter["stop_area_relations"] += 1

    logger.info("Fetched %d elements.", len(elements))
    logger.info(
        "  Nodes: %d, Ways: %d, Relations: %d",
        counter.get("node", 0),
        counter.get("way", 0),
        counter.get("relation", 0),
    )
    logger.info(
        "  Stations: %d, Stops: %d, Platforms: %d",
        counter.get("railway_station", 0),
        counter.get("railway_stop", 0),
        counter.get("pt_platform", 0),
    )
    logger.info(
        "  Route relations: %d, Stop areas: %d",
        counter.get("route_relations", 0),
        counter.get("stop_area_relations", 0),
    )


if __name__ == "__main__":
    fetch_and_save_osm_data()
