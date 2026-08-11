from __future__ import annotations

import asyncio
import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path

import httpx
import requests

from data.generator import compute_temp

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent
DATA_DIR = BACKEND_DIR / "data"
FRONTEND_DATA_DIR = PROJECT_DIR / "frontend" / "src" / "data"
ENV_PATH = BACKEND_DIR / ".env"
CACHE_PATH = DATA_DIR / "live_weather_cache.json"

CITY_CENTER = (12.9716, 77.5946)
WATER_BODIES = [
    (13.0407, 77.5970),  # Hebbal Lake
    (12.9847, 77.6245),  # Ulsoor Lake
    (12.9519, 77.6760),  # Bellandur Lake
    (12.9352, 77.6203),  # Lalbagh Lake
]

# Realistic constituency profiles based on BBMP ward reports, ISRO NDVI analyses,
# and IISC Bengaluru urban studies. Keys are AC_NAME from the GeoJSON.
# green_cover_pct: Approximate tree/vegetation cover percentage
# building_density: Built-up area ratio (0 = open land, 1 = fully built)
# albedo: Surface reflectivity (higher = more reflective/cooler)
CONSTITUENCY_PROFILES = {
    # --- Core Central (high density, low green cover) ---
    "Chickpet":              {"green_cover_pct": 8.0,  "building_density": 0.88, "albedo": 0.13},
    "Gandhinagar":           {"green_cover_pct": 10.0, "building_density": 0.85, "albedo": 0.14},
    "Chamrajapet":           {"green_cover_pct": 12.0, "building_density": 0.82, "albedo": 0.15},
    "Shantinagar":           {"green_cover_pct": 14.0, "building_density": 0.78, "albedo": 0.16},
    # --- Central with moderate green ---
    "Shivajinagar":          {"green_cover_pct": 24.0, "building_density": 0.65, "albedo": 0.20},  # Near Cubbon Park
    "Basavanagudi":          {"green_cover_pct": 22.0, "building_density": 0.68, "albedo": 0.19},  # Near Lalbagh
    "Malleshwaram":          {"green_cover_pct": 20.0, "building_density": 0.70, "albedo": 0.18},
    "Rajajinagar":           {"green_cover_pct": 15.0, "building_density": 0.76, "albedo": 0.16},
    "Jayanagar":             {"green_cover_pct": 22.0, "building_density": 0.66, "albedo": 0.19},
    "Padmanabanagar":        {"green_cover_pct": 18.0, "building_density": 0.72, "albedo": 0.17},
    # --- Mid-ring (mixed residential/commercial) ---
    "Pulakeshinagar":        {"green_cover_pct": 12.0, "building_density": 0.80, "albedo": 0.15},
    "Sarvagnanagar":         {"green_cover_pct": 14.0, "building_density": 0.75, "albedo": 0.16},
    "Hebbal":                {"green_cover_pct": 26.0, "building_density": 0.58, "albedo": 0.21},  # Near Hebbal Lake
    "C.V. RamannNagar":      {"green_cover_pct": 16.0, "building_density": 0.72, "albedo": 0.17},
    "Mahalakshmi Layout":    {"green_cover_pct": 13.0, "building_density": 0.78, "albedo": 0.15},
    "Govindarajanagar":      {"green_cover_pct": 14.0, "building_density": 0.76, "albedo": 0.16},
    "Vijayanagar":           {"green_cover_pct": 16.0, "building_density": 0.74, "albedo": 0.17},
    "B.T.M Layout":          {"green_cover_pct": 12.0, "building_density": 0.80, "albedo": 0.14},
    # --- Outer ring (rapid urbanization, IT corridors) ---
    "Mahadevapura":          {"green_cover_pct": 18.0, "building_density": 0.62, "albedo": 0.17},  # IT corridor, lakes
    "Bommanahalli":          {"green_cover_pct": 14.0, "building_density": 0.74, "albedo": 0.15},
    "K.R. Pura":             {"green_cover_pct": 20.0, "building_density": 0.60, "albedo": 0.18},
    "Yeshwanthapura":        {"green_cover_pct": 16.0, "building_density": 0.68, "albedo": 0.17},
    "Dasarahalli":           {"green_cover_pct": 18.0, "building_density": 0.65, "albedo": 0.18},
    "Byatarayanapura":       {"green_cover_pct": 22.0, "building_density": 0.55, "albedo": 0.20},
    "Rajarajeshwarinagar":   {"green_cover_pct": 20.0, "building_density": 0.58, "albedo": 0.19},
    # --- Peripheral (semi-urban, more green) ---
    "Yelahanka":             {"green_cover_pct": 30.0, "building_density": 0.42, "albedo": 0.23},  # Air Force area, lakes
    "Bangalore South":       {"green_cover_pct": 28.0, "building_density": 0.48, "albedo": 0.22},  # Large, mixed
    "Anekal":                {"green_cover_pct": 35.0, "building_density": 0.35, "albedo": 0.25},  # Most rural/green
}


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
        os.environ[key] = value


def discover_geojson_path() -> Path:
    candidates = sorted(FRONTEND_DATA_DIR.glob("*.geojson"))
    if not candidates:
        raise FileNotFoundError(f"No GeoJSON file found under {FRONTEND_DATA_DIR}")
    return candidates[0]


def _load_geojson() -> dict:
    geojson_path = discover_geojson_path()
    return json.loads(geojson_path.read_text(encoding="utf-8"))


def _select_all_constituencies(features: list[dict]) -> list[dict]:
    """Select and sort all constituencies by AC_CODE (no exclusions)."""
    features_copy = list(features)
    features_copy.sort(key=lambda feature: feature["properties"]["AC_CODE"])
    return features_copy


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
    """Look up realistic constituency profile, with heuristic fallback for unknown zones."""
    ac_name = feature.get("properties", {}).get("AC_NAME", "")
    area_sq_km = float(feature["properties"].get("Shape.STArea()", 0.0)) / 1_000_000.0
    distance_to_water_km = min(
        _haversine_km(latitude, longitude, water_lat, water_lng)
        for water_lat, water_lng in WATER_BODIES
    )

    profile = CONSTITUENCY_PROFILES.get(ac_name)
    if profile:
        return {
            "albedo": profile["albedo"],
            "green_cover_pct": profile["green_cover_pct"],
            "building_density": profile["building_density"],
            "distance_to_water_km": round(distance_to_water_km, 2),
            "area_sq_km": round(area_sq_km, 2),
        }

    # Heuristic fallback for any constituency not in the lookup table
    distance_to_center_km = _haversine_km(latitude, longitude, CITY_CENTER[0], CITY_CENTER[1])
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
        "area_sq_km": round(area_sq_km, 2),
    }


def build_seed_cache() -> dict:
    geojson = _load_geojson()
    all_features = _select_all_constituencies(geojson["features"])
    zones = []

    for rank, feature in enumerate(all_features, start=1):
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
        "selection_note": "All 28 assembly constituencies included.",
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


async def refresh_live_weather_cache() -> dict:
    """Refresh all constituency temperatures from Tomorrow.io using parallel async requests."""
    load_backend_env()
    api_key = os.getenv("TOMORROW_API_KEY")
    if not api_key:
        raise RuntimeError("TOMORROW_API_KEY is missing from backend/.env")

    payload = read_live_weather_cache()
    zones = payload["zones"]
    semaphore = asyncio.Semaphore(5)  # Limit to 5 concurrent requests to respect rate limits

    async def fetch_zone_weather(client: httpx.AsyncClient, zone: dict) -> dict:
        """Fetch weather for a single zone, returns result dict."""
        async with semaphore:
            latitude = zone["center"]["lat"]
            longitude = zone["center"]["lng"]
            try:
                response = await client.get(
                    "https://api.tomorrow.io/v4/weather/realtime",
                    params={
                        "location": f"{latitude},{longitude}",
                        "units": "metric",
                        "apikey": api_key,
                    },
                    timeout=20.0,
                )
                response.raise_for_status()
                realtime = response.json()
                temperature = realtime["data"]["values"]["temperature"]
                observed_at = realtime["data"].get("time")
                fetched_at = datetime.now(timezone.utc).isoformat()
                return {
                    "zone_id": zone["id"],
                    "success": True,
                    "temperature": round(float(temperature), 2),
                    "observed_at": observed_at,
                    "fetched_at": fetched_at,
                }
            except Exception as exc:
                return {
                    "zone_id": zone["id"],
                    "success": False,
                    "error": str(exc),
                }

    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            *(fetch_zone_weather(client, zone) for zone in zones)
        )

    # Apply results to zones
    result_map = {r["zone_id"]: r for r in results}
    refreshed_count = 0
    failures = []

    for zone in zones:
        result = result_map.get(zone["id"])
        if not result:
            continue
        if result["success"]:
            zone["temp"] = result["temperature"]
            zone["temp_source"] = "tomorrow.io"
            zone["weather"] = {
                "temperature": result["temperature"],
                "observed_at": result["observed_at"],
                "fetched_at": result["fetched_at"],
            }
            zone.pop("refresh_error", None)
            refreshed_count += 1
        else:
            zone["refresh_error"] = result["error"]
            failures.append({"id": zone["id"], "name": zone["name"], "error": result["error"]})

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

