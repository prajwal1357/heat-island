from __future__ import annotations

import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path

import requests

from data.generator import compute_temp

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent
DATA_DIR = BACKEND_DIR / "data"
FRONTEND_DATA_DIR = PROJECT_DIR / "frontend" / "src" / "data"
ENV_PATH = BACKEND_DIR / ".env"
CACHE_PATH = DATA_DIR / "live_weather_cache.json"

CITY_CENTER = (12.9716, 77.5946)
MAJOR_CONSTITUENCY_EXCLUSIONS = {"Anekal", "Bangalore South", "Yelahanka"}
WATER_BODIES = [
    (13.0407, 77.5970),  # Hebbal Lake
    (12.9847, 77.6245),  # Ulsoor Lake
    (12.9519, 77.6760),  # Bellandur Lake
    (12.9352, 77.6203),  # Lalbagh Lake
]


def load_backend_env() -> None:
    if not ENV_PATH.exists():
        return

    for raw_line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        os.environ.setdefault(key, value)


def discover_geojson_path() -> Path:
    candidates = sorted(FRONTEND_DATA_DIR.glob("*.geojson"))
    if not candidates:
        raise FileNotFoundError(f"No GeoJSON file found under {FRONTEND_DATA_DIR}")
    return candidates[0]


def _load_geojson() -> dict:
    geojson_path = discover_geojson_path()
    return json.loads(geojson_path.read_text(encoding="utf-8"))


def _select_main_constituencies(features: list[dict]) -> list[dict]:
    filtered = [
        feature
        for feature in features
        if feature.get("properties", {}).get("AC_NAME") not in MAJOR_CONSTITUENCY_EXCLUSIONS
    ]
    filtered.sort(key=lambda feature: feature["properties"]["AC_CODE"])
    return filtered[:25]


def _polygon_centroid(ring: list[list[float]]) -> tuple[float, float, float]:
    if len(ring) < 3:
        lngs = [point[0] for point in ring]
        lats = [point[1] for point in ring]
        return 0.0, sum(lngs) / max(len(lngs), 1), sum(lats) / max(len(lats), 1)

    signed_area = 0.0
    centroid_x = 0.0
    centroid_y = 0.0

    for index in range(len(ring) - 1):
        x0, y0 = ring[index]
        x1, y1 = ring[index + 1]
        cross = (x0 * y1) - (x1 * y0)
        signed_area += cross
        centroid_x += (x0 + x1) * cross
        centroid_y += (y0 + y1) * cross

    signed_area *= 0.5
    if abs(signed_area) < 1e-12:
        lngs = [point[0] for point in ring]
        lats = [point[1] for point in ring]
        return 0.0, sum(lngs) / len(lngs), sum(lats) / len(lats)

    centroid_x /= 6.0 * signed_area
    centroid_y /= 6.0 * signed_area
    return abs(signed_area), centroid_x, centroid_y


def _geometry_centroid(geometry: dict) -> tuple[float, float]:
    polygons: list[list[list[float]]] = []
    if geometry["type"] == "Polygon":
        polygons = [geometry["coordinates"][0]]
    elif geometry["type"] == "MultiPolygon":
        polygons = [polygon[0] for polygon in geometry["coordinates"]]
    else:
        raise ValueError(f"Unsupported geometry type: {geometry['type']}")

    weighted_area = 0.0
    weighted_lng = 0.0
    weighted_lat = 0.0

    for ring in polygons:
        area, centroid_lng, centroid_lat = _polygon_centroid(ring)
        if area <= 0:
            continue
        weighted_area += area
        weighted_lng += centroid_lng * area
        weighted_lat += centroid_lat * area

    if weighted_area <= 0:
        first_point = polygons[0][0]
        return first_point[1], first_point[0]

    return weighted_lat / weighted_area, weighted_lng / weighted_area


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius_km = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return 2 * earth_radius_km * math.asin(math.sqrt(a))


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(value, maximum))


def _estimate_zone_features(feature: dict, latitude: float, longitude: float) -> dict:
    area_sq_km = float(feature["properties"].get("Shape.STArea()", 0.0)) / 1_000_000.0
    distance_to_center_km = _haversine_km(latitude, longitude, CITY_CENTER[0], CITY_CENTER[1])
    distance_to_water_km = min(
        _haversine_km(latitude, longitude, water_lat, water_lng)
        for water_lat, water_lng in WATER_BODIES
    )

    density_score = 1.0 - min(distance_to_center_km / 22.0, 1.0)
    size_penalty = min(area_sq_km / 120.0, 0.25)

    building_density = _clamp(0.38 + (density_score * 0.42) - size_penalty, 0.12, 0.95)
    green_cover_pct = _clamp(14.0 + ((1.0 - density_score) * 28.0) + (area_sq_km * 0.08), 8.0, 58.0)
    albedo = _clamp(0.13 + (green_cover_pct / 300.0) + ((1.0 - building_density) * 0.05), 0.1, 0.38)

    return {
        "albedo": round(albedo, 3),
        "green_cover_pct": round(green_cover_pct, 2),
        "building_density": round(building_density, 3),
        "distance_to_water_km": round(distance_to_water_km, 2),
    }


def build_seed_cache() -> dict:
    geojson = _load_geojson()
    selected_features = _select_main_constituencies(geojson["features"])
    zones = []

    for rank, feature in enumerate(selected_features, start=1):
        latitude, longitude = _geometry_centroid(feature["geometry"])
        ml_features = _estimate_zone_features(feature, latitude, longitude)
        base_temp = round(compute_temp(ml_features), 2)

        zones.append(
            {
                "id": int(feature["properties"]["AC_CODE"]),
                "rank": rank,
                "name": feature["properties"]["AC_NAME"],
                "name_kn": feature["properties"].get("AC_NAME_KN"),
                "pc_code": int(feature["properties"]["PC_CODE"]),
                "center": {"lat": round(latitude, 6), "lng": round(longitude, 6)},
                "temp": base_temp,
                "temp_source": "seed",
                "weather": {
                    "temperature": base_temp,
                    "observed_at": None,
                    "fetched_at": None,
                },
                "geometry": feature["geometry"],
                **ml_features,
            }
        )

    return {
        "city": "Bengaluru",
        "zone_count": len(zones),
        "selection_note": "Excluded Yelahanka, Bangalore South, and Anekal to keep 25 core constituencies.",
        "source_geojson": discover_geojson_path().name,
        "last_refreshed_at": None,
        "weather_provider": "cache-only",
        "zones": zones,
    }


def ensure_live_weather_cache() -> dict:
    if CACHE_PATH.exists():
        payload = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        if payload.get("zones"):
            return payload

    payload = build_seed_cache()
    write_live_weather_cache(payload)
    return payload


def read_live_weather_cache() -> dict:
    return ensure_live_weather_cache()


def write_live_weather_cache(payload: dict) -> None:
    CACHE_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def refresh_live_weather_cache() -> dict:
    load_backend_env()
    api_key = os.getenv("TOMORROW_API_KEY")
    if not api_key:
        raise RuntimeError("TOMORROW_API_KEY is missing from backend/.env")

    payload = read_live_weather_cache()
    zones = payload["zones"]
    refreshed_count = 0
    failures = []

    for zone in zones:
        latitude = zone["center"]["lat"]
        longitude = zone["center"]["lng"]
        try:
            response = requests.get(
                "https://api.tomorrow.io/v4/weather/realtime",
                params={
                    "location": f"{latitude},{longitude}",
                    "units": "metric",
                    "apikey": api_key,
                },
                timeout=20,
            )
            response.raise_for_status()
            realtime = response.json()
            temperature = realtime["data"]["values"]["temperature"]
            observed_at = realtime["data"].get("time")
            fetched_at = datetime.now(timezone.utc).isoformat()

            zone["temp"] = round(float(temperature), 2)
            zone["temp_source"] = "tomorrow.io"
            zone["weather"] = {
                "temperature": round(float(temperature), 2),
                "observed_at": observed_at,
                "fetched_at": fetched_at,
            }
            zone.pop("refresh_error", None)
            refreshed_count += 1
        except Exception as exc:
            zone["refresh_error"] = str(exc)
            failures.append({"id": zone["id"], "name": zone["name"], "error": str(exc)})

    if refreshed_count == 0:
        raise RuntimeError("Tomorrow.io refresh failed for all constituencies.")

    payload["last_refreshed_at"] = datetime.now(timezone.utc).isoformat()
    payload["weather_provider"] = "Tomorrow.io" if not failures else "Tomorrow.io (partial)"
    payload["refresh_status"] = {
        "refreshed_count": refreshed_count,
        "failed_count": len(failures),
        "failures": failures,
    }
    write_live_weather_cache(payload)
    return payload
