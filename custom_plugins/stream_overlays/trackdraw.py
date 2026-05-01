"""TrackDraw REST client and cache helpers for stream overlays."""

import json
import logging
from datetime import UTC, datetime
from typing import Any

import requests

TRACKDRAW_API_ORIGIN = "https://trackdraw.app"
TRACKDRAW_CACHE_TTL_SECONDS = 24 * 60 * 60

PROJECT_ID_OPTION = "stream_overlays_trackdraw_project_id"
API_KEY_OPTION = "stream_overlays_trackdraw_api_key"
SPLIT_MAP_OPTION = "stream_overlays_trackdraw_split_map"
CACHE_OPTION = "stream_overlays_trackdraw_cache_v1"

logger = logging.getLogger(__name__)


class TrackDrawClientError(Exception):
    """Raised when the TrackDraw overlay package cannot be refreshed."""

    def __init__(self, state: str, message: str, package: dict | None = None) -> None:
        """Initialize a TrackDraw client error."""
        super().__init__(message)
        self.state = state
        self.message = message
        self.package = package


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp."""
    return datetime.now(UTC)


def to_iso(value: datetime) -> str:
    """Serialize UTC datetimes in API-friendly ISO format."""
    return value.isoformat().replace("+00:00", "Z")


def parse_iso(value: str) -> datetime | None:
    """Parse an ISO timestamp from the plugin cache."""
    try:
        return datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def normalize_option(value: Any) -> str:
    """Normalize RotorHazard option values into stripped strings."""
    if value is None or value is False:
        return ""
    return str(value).strip()


def validate_overlay_package(payload: Any) -> dict:
    """Validate the TrackDraw v1 envelope and return the overlay package."""
    if not isinstance(payload, dict):
        state = "unsupported_schema"
        message = "Response is not JSON."
        raise TrackDrawClientError(state, message)

    package = payload.get("data")
    if not isinstance(package, dict):
        state = "unsupported_schema"
        message = "Response does not contain a data object."
        raise TrackDrawClientError(state, message)

    if package.get("schema") != "trackdraw.overlay.v1":
        state = "unsupported_schema"
        message = "Response is not a TrackDraw overlay package."
        raise TrackDrawClientError(state, message)

    readiness = package.get("readiness")
    if not isinstance(readiness, dict):
        state = "unsupported_schema"
        message = "Overlay package has no readiness report."
        raise TrackDrawClientError(state, message)

    if readiness.get("status") != "ready":
        state = "blocked"
        message = "TrackDraw overlay package is not ready."
        raise TrackDrawClientError(state, message, package)

    if not isinstance(package.get("route"), dict):
        state = "blocked"
        message = "TrackDraw overlay package has no usable route."
        raise TrackDrawClientError(state, message, package)

    return package


class TrackDrawOverlayStore:
    """Fetch and cache a TrackDraw overlay package through RotorHazard options."""

    def __init__(self, rhapi: object) -> None:
        """Initialize the TrackDraw overlay store."""
        self._rhapi = rhapi
        self._session = requests.Session()

    def get_project_id(self) -> str:
        """Return the configured TrackDraw project id."""
        return normalize_option(self._rhapi.db.option(PROJECT_ID_OPTION, ""))

    def get_api_key(self) -> str:
        """Return the configured TrackDraw API key."""
        return normalize_option(self._rhapi.db.option(API_KEY_OPTION, ""))

    def get_split_map(self) -> str:
        """Return the configured RotorHazard split map."""
        return normalize_option(self._rhapi.db.option(SPLIT_MAP_OPTION, ""))

    def load_cache(self) -> dict | None:
        """Load the last-good-ready TrackDraw cache from RotorHazard options."""
        raw_cache = normalize_option(self._rhapi.db.option(CACHE_OPTION, ""))
        if not raw_cache:
            return None

        try:
            cache = json.loads(raw_cache)
        except (TypeError, ValueError):
            logger.warning("Ignoring invalid TrackDraw overlay cache")
            return None

        if not isinstance(cache, dict) or not isinstance(cache.get("package"), dict):
            return None

        return cache

    def save_cache(self, package: dict) -> dict:
        """Persist a last-good-ready overlay package for offline race-day use."""
        now = utc_now()
        cache = {
            "cached_at": to_iso(now),
            "package": package,
            "schema": "trackdraw.overlay.cache.v1",
            "source_updated_at": package.get("updated_at"),
        }
        self._rhapi.db.option_set(CACHE_OPTION, json.dumps(cache))
        return cache

    def get_cache_state(self, cache: dict) -> dict:
        """Return cache age and freshness metadata."""
        cached_at = parse_iso(cache.get("cached_at", ""))
        now = utc_now()
        age_seconds = None

        if cached_at:
            age_seconds = max(0, int((now - cached_at).total_seconds()))

        is_fresh = (
            age_seconds is not None and age_seconds <= TRACKDRAW_CACHE_TTL_SECONDS
        )

        return {
            "cached_at": cache.get("cached_at"),
            "fresh_for_seconds": TRACKDRAW_CACHE_TTL_SECONDS,
            "age_seconds": age_seconds,
            "source_updated_at": cache.get("source_updated_at"),
            "status": "fresh" if is_fresh else "stale",
        }

    def fetch_package(self) -> dict:
        """Fetch and validate the configured TrackDraw overlay package."""
        project_id = self.get_project_id()
        api_key = self.get_api_key()

        if not project_id or not api_key:
            state = "missing_config"
            message = "Configure a TrackDraw project ID and API key."
            raise TrackDrawClientError(state, message)

        url = (
            f"{TRACKDRAW_API_ORIGIN}/api/v1/projects/"
            f"{requests.utils.quote(project_id, safe='')}/overlay"
        )

        try:
            response = self._session.get(
                url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Accept": "application/json",
                },
                timeout=5,
            )
        except requests.RequestException as exc:
            state = "network_failed"
            message = "TrackDraw could not be reached."
            raise TrackDrawClientError(state, message) from exc

        if response.status_code in (401, 403):
            state = "auth_failed"
            message = "TrackDraw rejected the configured API key."
            raise TrackDrawClientError(state, message)

        if response.status_code == 404:
            state = "not_found"
            message = "TrackDraw project was not found for this API key."
            raise TrackDrawClientError(state, message)

        if response.status_code >= 400:
            state = "refresh_failed"
            message = f"TrackDraw returned HTTP {response.status_code}."
            raise TrackDrawClientError(state, message)

        try:
            payload = response.json()
        except ValueError as exc:
            state = "unsupported_schema"
            message = "TrackDraw returned invalid JSON."
            raise TrackDrawClientError(state, message) from exc

        return validate_overlay_package(payload)

    def refresh(self) -> dict:
        """Fetch TrackDraw data and update the durable cache when ready."""
        package = self.fetch_package()
        cache = self.save_cache(package)
        return {
            "ok": True,
            "state": "fresh",
            "track": package,
            "cache": self.get_cache_state(cache),
            "split_map": self.get_split_map(),
        }

    def get_payload(self, *, force_refresh: bool = False) -> dict:
        """Return a cached or freshly refreshed overlay payload."""
        cache = self.load_cache()

        if force_refresh or cache is None:
            try:
                return self.refresh()
            except TrackDrawClientError as exc:
                if cache:
                    cache_state = self.get_cache_state(cache)
                    return {
                        "ok": True,
                        "state": cache_state["status"],
                        "track": cache["package"],
                        "cache": cache_state,
                        "refresh_error": {
                            "state": exc.state,
                            "message": exc.message,
                        },
                        "split_map": self.get_split_map(),
                    }

                return {
                    "ok": False,
                    "state": exc.state,
                    "track": exc.package,
                    "cache": None,
                    "error": exc.message,
                    "split_map": self.get_split_map(),
                }

        cache_state = self.get_cache_state(cache)
        return {
            "ok": True,
            "state": cache_state["status"],
            "track": cache["package"],
            "cache": cache_state,
            "split_map": self.get_split_map(),
        }
