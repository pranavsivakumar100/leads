"""Lead-generation orchestration.

Replicates the standalone generate_leads.py logic as a reusable service:
- builds a "{service} in {location}" query,
- for deep searches, tiles a coordinate grid around the metro to beat
  Google's ~60-results-per-query cap (the generic version of the named
  neighborhood tiling used in the original script),
- de-duplicates by place id,
- ranks with a Bayesian weighted quality score.
"""
from __future__ import annotations

from app.services.places import PlacesClient

# Preset service label -> Places search term. Mirrors the original script.
SERVICE_PRESETS: dict[str, str] = {
    "Electrical": "electrician",
    "Plumbing": "plumber",
    "HVAC": "HVAC contractor",
    "Roofing": "roofing contractor",
    "Landscaping": "landscaping service",
    "Pest Control": "pest control",
    "House Cleaning": "house cleaning service",
    "Handyman": "handyman",
    "Painting": "painting contractor",
    "General Contractor": "general contractor",
    "Garage Door": "garage door repair",
    "Locksmith": "locksmith",
    "Appliance Repair": "appliance repair",
    "Flooring": "flooring contractor",
    "Tree Service": "tree service",
    "Gutter": "gutter installation",
    "Fencing": "fencing contractor",
    "Masonry": "masonry contractor",
    "Water Damage": "water damage restoration",
    "Junk Removal": "junk removal",
    "Moving": "moving company",
    "Pool Service": "pool service",
}

_KM_PER_DEG_LAT = 111.0
_BAYES_PRIOR_WEIGHT = 8  # `m` in the weighted-rating formula
_DEFAULT_RADIUS_KM = 15.0


def resolve_query(service: str) -> str:
    """Map a preset label to its search term, or use the raw string as-is."""
    return SERVICE_PRESETS.get(service, service)


def _quality_score(rating, count, prior_mean: float, m: int = _BAYES_PRIOR_WEIGHT) -> float:
    """Bayesian weighted rating — pulls low-review places toward the mean."""
    if not rating or not count:
        return 0.0
    r, v = float(rating), int(count)
    return (v / (v + m)) * r + (m / (v + m)) * prior_mean


def _grid_bias(center: dict, radius_km: float, ring: int = 1) -> list[dict]:
    """Build locationBias circles on a (2*ring+1)^2 grid covering radius_km.

    Keeps the tile count fixed (default 3x3) and scales the spacing + tile
    radius with the requested radius, so cost stays bounded regardless of area.
    """
    import math

    lat = center["latitude"]
    lng = center["longitude"]

    # Spread the ring of tiles so the grid roughly spans the target radius.
    step_km = (radius_km * 0.66) / ring
    step_lat = step_km / _KM_PER_DEG_LAT
    # Longitude degrees shrink with latitude.
    cos_lat = max(math.cos(math.radians(lat)), 0.01)
    step_lng = step_km / (_KM_PER_DEG_LAT * cos_lat)
    tile_radius_m = max(step_km, 1.0) * 1000.0

    biases: list[dict] = []
    for i in range(-ring, ring + 1):
        for j in range(-ring, ring + 1):
            biases.append(
                {
                    "circle": {
                        "center": {
                            "latitude": lat + i * step_lat,
                            "longitude": lng + j * step_lng,
                        },
                        "radius": tile_radius_m,
                    }
                }
            )
    return biases


def _city_center(client: PlacesClient, location: str) -> dict | None:
    """Resolve a location string to a lat/lng using the first search result."""
    try:
        res = client.search_text(location, page_size=1)
    except Exception:
        return None
    places = res.get("places", [])
    if not places:
        return None
    return places[0].get("location")


def _process(places: list[dict]) -> list[dict]:
    rated = [
        p
        for p in places
        if p.get("businessStatus", "OPERATIONAL") != "CLOSED_PERMANENTLY"
    ]
    ratings = [p["rating"] for p in rated if p.get("rating")]
    prior = sum(ratings) / len(ratings) if ratings else 4.0

    rows: list[dict] = []
    for p in rated:
        rating = p.get("rating")
        count = p.get("userRatingCount")
        website = p.get("websiteUri", "")
        rows.append(
            {
                "name": p.get("displayName", {}).get("text", ""),
                "phone": p.get("nationalPhoneNumber", ""),
                "website": website,
                "address": p.get("formattedAddress", ""),
                "rating": rating,
                "reviews": count or 0,
                "score": round(_quality_score(rating, count, prior), 3),
                "has_website": bool(website),
                "status": p.get("businessStatus", ""),
                "maps_uri": p.get("googleMapsUri", ""),
            }
        )
    rows.sort(key=lambda x: (x["score"], x["reviews"]), reverse=True)
    return rows


def run_search(
    api_key: str,
    service: str,
    location: str,
    *,
    deep: bool = True,
    max_results: int = 300,
    radius_km: float = _DEFAULT_RADIUS_KM,
) -> list[dict]:
    """Scrape leads for one service in one location, ranked best -> worst."""
    client = PlacesClient(api_key)
    query = resolve_query(service)

    # Wider areas need a denser grid; keep tile count bounded.
    ring = 1 if radius_km <= 20 else (2 if radius_km <= 45 else 3)

    merged: dict[str, dict] = {}

    # Central paginated query (up to ~60 results).
    merged.update(client.paginate(f"{query} in {location}", max_pages=3))

    # Deep coverage: tile a coordinate grid around the metro center.
    if deep:
        center = _city_center(client, location)
        if center:
            for bias in _grid_bias(center, radius_km, ring=ring):
                if len(merged) >= max_results:
                    break
                # One page per tile — spatial diversity replaces deep pagination.
                page = client.paginate(query, location_bias=bias, max_pages=1)
                merged.update(page)

    rows = _process(list(merged.values()))
    return rows[:max_results]
