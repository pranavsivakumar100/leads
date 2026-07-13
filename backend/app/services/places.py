"""Thin client over the Google Places API (New) — text search + pagination."""
from __future__ import annotations

import time

import requests

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete"

# Cities, neighborhoods, states, and zip codes — good for lead-gen targeting.
LOCATION_TYPES = [
    "locality",
    "administrative_area_level_1",
    "postal_code",
    "sublocality",
]

# Fields we request. Kept lean to control billing (SKU is field-tier based).
FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.nationalPhoneNumber",
        "places.websiteUri",
        "places.rating",
        "places.userRatingCount",
        "places.businessStatus",
        "places.googleMapsUri",
        "places.location",
        "nextPageToken",
    ]
)


class PlacesError(RuntimeError):
    """Raised when the Places API returns a non-success response."""


class PlacesClient:
    def __init__(self, api_key: str, timeout: float = 30.0) -> None:
        self._api_key = api_key
        self._timeout = timeout

    def search_text(
        self,
        text_query: str,
        *,
        page_token: str | None = None,
        location_bias: dict | None = None,
        page_size: int = 20,
    ) -> dict:
        body: dict = {"textQuery": text_query, "pageSize": page_size}
        if page_token:
            body["pageToken"] = page_token
        if location_bias:
            body["locationBias"] = location_bias

        resp = requests.post(
            SEARCH_URL,
            json=body,
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": self._api_key,
                "X-Goog-FieldMask": FIELD_MASK,
            },
            timeout=self._timeout,
        )
        if resp.status_code != 200:
            raise PlacesError(f"Places API {resp.status_code}: {resp.text[:200]}")
        return resp.json()

    def paginate(
        self,
        text_query: str,
        *,
        location_bias: dict | None = None,
        max_pages: int = 3,
        page_pause: float = 2.0,
    ) -> dict[str, dict]:
        """Run a query and follow nextPageToken. Returns {place_id: place}."""
        found: dict[str, dict] = {}
        token: str | None = None
        for i in range(max_pages):
            res = self.search_text(
                text_query, page_token=token, location_bias=location_bias
            )
            for place in res.get("places", []):
                found[place["id"]] = place
            token = res.get("nextPageToken")
            if not token:
                break
            if i < max_pages - 1:
                # Token needs a brief moment to activate.
                time.sleep(page_pause)
        return found

    def autocomplete(self, input_text: str, *, limit: int = 8) -> list[dict]:
        """Return location suggestions for a partial query."""
        resp = requests.post(
            AUTOCOMPLETE_URL,
            json={
                "input": input_text,
                "includedPrimaryTypes": LOCATION_TYPES,
                "languageCode": "en",
            },
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": self._api_key,
                "X-Goog-FieldMask": ",".join(
                    [
                        "suggestions.placePrediction.placeId",
                        "suggestions.placePrediction.text",
                        "suggestions.placePrediction.structuredFormat",
                    ]
                ),
            },
            timeout=self._timeout,
        )
        if resp.status_code != 200:
            raise PlacesError(f"Places API {resp.status_code}: {resp.text[:200]}")

        suggestions: list[dict] = []
        for item in resp.json().get("suggestions", []):
            pred = item.get("placePrediction")
            if not pred:
                continue
            structured = pred.get("structuredFormat", {})
            main = structured.get("mainText", {}).get("text", "")
            secondary = structured.get("secondaryText", {}).get("text", "")
            label = pred.get("text", {}).get("text", "")
            if not label:
                continue
            suggestions.append(
                {
                    "place_id": pred.get("placeId", ""),
                    "label": label,
                    "main_text": main,
                    "secondary_text": secondary,
                }
            )
            if len(suggestions) >= limit:
                break
        return suggestions
