"""TrackDraw REST client and cache helpers for stream overlays."""

import json
import logging
from datetime import UTC, datetime
from typing import Any

import requests

from .const import (
    API_KEY_KEY,
    CACHE_OPTION,
    PROJECT_ID_KEY,
    TRACKDRAW_API_ORIGIN,
    TRACKDRAW_CACHE_TTL_SECONDS,
    TRACKDRAW_CONFIG_SECTION,
)

logger = logging.getLogger(__name__)

READINESS_ISSUE_LABELS = {
    "duplicate-start-finish": "More than one start/finish timing marker is set.",
    "duplicate-timing-id": "Multiple timing markers use the same timing ID.",
    "missing-route": "No race route is available.",
    "missing-split-id": "A split timing marker has no timing ID.",
    "missing-start-finish": "No start/finish timing marker is set.",
    "multiple-routes": "Multiple race routes are present.",
    "timing-point-off-route": "A timing marker is too far away from the route.",
}


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


def format_number(value: Any, suffix: str = "") -> str:
    """Format a numeric diagnostic value."""
    if not isinstance(value, int | float) or isinstance(value, bool):
        return ""
    return f"{value:.1f}{suffix}"


def get_shape_titles(package: dict) -> dict[str, str]:
    """Return a lookup of TrackDraw shape IDs to operator-facing titles."""
    shape_titles = {}
    timing_markers = package.get("timing_markers")
    if not isinstance(timing_markers, list):
        return shape_titles

    for marker in timing_markers:
        if not isinstance(marker, dict):
            continue

        shape_id = marker.get("shape_id")
        title = marker.get("title")
        if isinstance(shape_id, str) and isinstance(title, str) and title:
            shape_titles[shape_id] = title

    return shape_titles


def get_shape_label(shape_id: str, shape_titles: dict[str, str]) -> str:
    """Return a readable label for a TrackDraw shape reference."""
    title = shape_titles.get(shape_id)
    if title:
        return f"{title} ({shape_id})"
    return shape_id


def get_issue_detail(issue: dict, shape_titles: dict[str, str]) -> str:
    """Return compact issue metadata without exposing full package internals."""
    detail_parts = []

    shape_id = issue.get("shape_id")
    if isinstance(shape_id, str) and shape_id:
        detail_parts.append(f"shape {get_shape_label(shape_id, shape_titles)}")

    shape_ids = issue.get("shape_ids")
    if isinstance(shape_ids, list) and shape_ids:
        ids = [shape_id for shape_id in shape_ids if isinstance(shape_id, str)]
        if ids:
            labels = [get_shape_label(shape_id, shape_titles) for shape_id in ids[:3]]
            detail_parts.append(f"shapes {', '.join(labels)}")

    route_id = issue.get("route_id")
    if isinstance(route_id, str) and route_id:
        detail_parts.append(f"route {route_id}")

    timing_id = issue.get("timing_id")
    if isinstance(timing_id, str) and timing_id:
        detail_parts.append(f"timing ID {timing_id}")

    distance = format_number(issue.get("distance_m"), "m")
    tolerance = format_number(issue.get("tolerance_m"), "m")
    if distance and tolerance:
        detail_parts.append(f"{distance} from route, tolerance {tolerance}")
    elif distance:
        detail_parts.append(f"{distance} from route")

    return "; ".join(detail_parts)


def get_readiness_diagnostics(package: dict | None) -> dict:
    """Return structured TrackDraw readiness diagnostics for clients."""
    if not isinstance(package, dict):
        return {
            "status": "unknown",
            "summary": "No TrackDraw overlay package was returned.",
            "issue_count": 0,
            "issues": [],
        }

    readiness = package.get("readiness")
    if not isinstance(readiness, dict):
        return {
            "status": "unknown",
            "summary": "TrackDraw overlay package has no readiness report.",
            "issue_count": 0,
            "issues": [],
        }

    raw_issues = readiness.get("issues")
    shape_titles = get_shape_titles(package)
    issues = []
    if isinstance(raw_issues, list):
        for issue in raw_issues:
            if not isinstance(issue, dict) or not isinstance(issue.get("type"), str):
                continue

            issue_type = issue["type"]
            issues.append(
                {
                    "type": issue_type,
                    "severity": issue.get("severity", "error"),
                    "message": READINESS_ISSUE_LABELS.get(
                        issue_type, issue_type.replace("-", " ")
                    ),
                    "detail": get_issue_detail(issue, shape_titles),
                }
            )

    status = readiness.get("status")
    if not isinstance(status, str):
        status = "unknown"

    if status == "ready":
        summary = "TrackDraw overlay package is ready."
    elif issues:
        issue_names = ", ".join(issue["type"] for issue in issues)
        summary = f"TrackDraw overlay package is blocked: {issue_names}."
    else:
        summary = "TrackDraw overlay package is blocked."

    return {
        "status": status,
        "summary": summary,
        "issue_count": len(issues),
        "issues": issues,
        "race_route_id": readiness.get("race_route_id"),
        "route_length_m": readiness.get("route_length_m"),
    }


def summarize_readiness_issues(package: dict | None) -> str:
    """Return a compact readiness issue summary for operator-facing messages."""
    diagnostics = get_readiness_diagnostics(package)
    issues = diagnostics.get("issues")
    if not isinstance(issues, list) or not issues:
        return ""

    unique_issue_types = sorted(
        {issue["type"] for issue in issues if isinstance(issue.get("type"), str)}
    )
    return ", ".join(unique_issue_types)


def get_blocked_message(package: dict | None) -> str:
    """Return a useful message for blocked TrackDraw overlay packages."""
    issue_summary = summarize_readiness_issues(package)
    if issue_summary:
        return f"TrackDraw overlay package is not ready: {issue_summary}."
    return "TrackDraw overlay package is not ready."


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
        message = get_blocked_message(package)
        raise TrackDrawClientError(state, message, package)

    if not isinstance(package.get("route"), dict):
        state = "blocked"
        message = "TrackDraw overlay package has no usable route."
        raise TrackDrawClientError(state, message, package)

    return package


def derive_split_map(package: dict | None) -> dict[str, str]:
    """Derive RotorHazard split_id to TrackDraw timing_id mapping."""
    if not isinstance(package, dict):
        return {}

    readiness = package.get("readiness")
    if not isinstance(readiness, dict):
        return {}

    timing_points = readiness.get("timing_points")
    if not isinstance(timing_points, list):
        return {}

    split_map: dict[str, str] = {}

    for point in timing_points:
        if (
            not isinstance(point, dict)
            or point.get("role") != "split"
            or not isinstance(point.get("timing_id"), str)
            or not point["timing_id"].strip()
        ):
            continue

        split_index = point.get("split_index")
        if isinstance(split_index, int) and not isinstance(split_index, bool):
            split_map[str(split_index)] = point["timing_id"].strip()

    return split_map


class TrackDrawOverlayStore:
    """Fetch and cache a TrackDraw overlay package through RotorHazard config."""

    def __init__(self, rhapi: object) -> None:
        """Initialize the TrackDraw overlay store."""
        self._rhapi = rhapi
        self._session = requests.Session()

    def get_project_id(self) -> str:
        """Return the configured TrackDraw project id."""
        return normalize_option(
            self._rhapi.config.get_item(TRACKDRAW_CONFIG_SECTION, PROJECT_ID_KEY)
        )

    def get_api_key(self) -> str:
        """Return the configured TrackDraw API key."""
        return normalize_option(
            self._rhapi.config.get_item(TRACKDRAW_CONFIG_SECTION, API_KEY_KEY)
        )

    def has_config(self) -> bool:
        """Return whether the required TrackDraw credentials are configured."""
        return bool(self.get_project_id() and self.get_api_key())

    def get_config_state(self) -> dict:
        """Return non-secret configuration state for diagnostics."""
        return {
            "has_project_id": bool(self.get_project_id()),
            "has_api_key": bool(self.get_api_key()),
        }

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

    def should_auto_refresh(self, cache: dict | None) -> bool:
        """Return whether the cache should be refreshed automatically."""
        if not self.has_config():
            return False
        if cache is None:
            return True
        return self.get_cache_state(cache)["status"] == "stale"

    def get_cache_payload(
        self,
        cache: dict,
        refresh_error: TrackDrawClientError | None = None,
    ) -> dict:
        """Return the public payload for a cached TrackDraw package."""
        cache_state = self.get_cache_state(cache)
        payload = {
            "ok": True,
            "state": cache_state["status"],
            "track": cache["package"],
            "cache": cache_state,
            "config": self.get_config_state(),
            "diagnostics": {
                "readiness": get_readiness_diagnostics(cache["package"]),
            },
            "split_map": derive_split_map(cache["package"]),
        }

        if refresh_error:
            payload["refresh_error"] = {
                "state": refresh_error.state,
                "message": refresh_error.message,
                "diagnostics": {
                    "readiness": get_readiness_diagnostics(refresh_error.package),
                },
            }

        return payload

    def get_error_payload(self, error: TrackDrawClientError | None = None) -> dict:
        """Return the public payload for a missing or failed TrackDraw package."""
        if error:
            track = error.package
            state = error.state
            message = error.message
        elif self.has_config():
            track = None
            state = "missing_cache"
            message = "No cached TrackDraw overlay package is available."
        else:
            track = None
            state = "missing_config"
            message = "Configure a TrackDraw project ID and API key."

        return {
            "ok": False,
            "state": state,
            "track": track,
            "cache": None,
            "config": self.get_config_state(),
            "diagnostics": {
                "readiness": get_readiness_diagnostics(track),
            },
            "error": message,
            "split_map": derive_split_map(track),
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
        return self.get_cache_payload(cache)

    def get_payload(self, *, force_refresh: bool = False) -> dict:
        """Return a cached or freshly refreshed overlay payload."""
        cache = self.load_cache()

        if force_refresh or self.should_auto_refresh(cache):
            try:
                return self.refresh()
            except TrackDrawClientError as exc:
                if cache:
                    return self.get_cache_payload(cache, refresh_error=exc)

                return self.get_error_payload(exc)

        if cache is None:
            return self.get_error_payload()

        return self.get_cache_payload(cache)
