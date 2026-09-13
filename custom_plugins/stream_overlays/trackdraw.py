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

_ISSUE_LABELS: dict[str, str] = {
    "duplicate-start-finish": "More than one start/finish timing marker is set.",
    "duplicate-timing-id": "Multiple timing markers use the same timing ID.",
    "missing-route": "No race route is available.",
    "missing-split-id": "A split timing marker has no timing ID.",
    "missing-start-finish": "No start/finish timing marker is set.",
    "multiple-routes": "Multiple race routes are present.",
    "timing-point-off-route": "A timing marker is too far away from the route.",
}


class TrackDrawClientError(Exception):
    """Raised when the TrackDraw overlay package cannot be fetched or validated."""

    def __init__(self, state: str, message: str, package: dict | None = None) -> None:
        """Initialize a TrackDraw client error."""
        super().__init__(message)
        self.state = state
        self.message = message
        self.package = package


# ---- Private module helpers ----


def _utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp."""
    return datetime.now(UTC)


def _to_iso(value: datetime) -> str:
    """Serialize a UTC datetime as an API-friendly ISO string."""
    return value.isoformat().replace("+00:00", "Z")


def _parse_iso(value: str) -> datetime | None:
    """Parse an ISO timestamp; return None on any parse failure."""
    try:
        dt = datetime.fromisoformat(value)
        return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)
    except (TypeError, ValueError):
        return None


def _normalize(value: Any) -> str:
    """Normalize RotorHazard option values to stripped strings."""
    if value is None or value is False:
        return ""
    return str(value).strip()


def _issue_detail(issue: dict, shape_titles: dict[str, str]) -> str:
    """Return compact issue metadata without exposing full package internals."""
    parts: list[str] = []

    def _shape_label(sid: str) -> str:
        """Return a readable label for a TrackDraw shape reference."""
        title = shape_titles.get(sid)
        return f"{title} ({sid})" if title else sid

    shape_id = issue.get("shape_id")
    if isinstance(shape_id, str) and shape_id:
        parts.append(f"shape {_shape_label(shape_id)}")

    shape_ids = issue.get("shape_ids")
    if isinstance(shape_ids, list) and shape_ids:
        labels = [_shape_label(s) for s in shape_ids if isinstance(s, str)][:3]
        if labels:
            parts.append(f"shapes {', '.join(labels)}")

    route_id = issue.get("route_id")
    if isinstance(route_id, str) and route_id:
        parts.append(f"route {route_id}")

    timing_id = issue.get("timing_id")
    if isinstance(timing_id, str) and timing_id:
        parts.append(f"timing ID {timing_id}")

    dist = issue.get("distance_m")
    tol = issue.get("tolerance_m")
    if isinstance(dist, (int, float)) and not isinstance(dist, bool):
        d_str = f"{dist:.1f}m"
        if isinstance(tol, (int, float)) and not isinstance(tol, bool):
            parts.append(f"{d_str} from route, tolerance {tol:.1f}m")
        else:
            parts.append(f"{d_str} from route")

    return "; ".join(parts)


# ---- Public module-level functions ----


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

    shape_titles = {
        m["shape_id"]: m["title"]
        for m in (package.get("timing_markers") or [])
        if isinstance(m, dict)
        and isinstance(m.get("shape_id"), str)
        and isinstance(m.get("title"), str)
        and m["title"]
    }

    issues = []
    for issue in readiness.get("issues") or []:
        if not isinstance(issue, dict) or not isinstance(issue.get("type"), str):
            continue
        t = issue["type"]
        issues.append(
            {
                "type": t,
                "severity": issue.get("severity", "error"),
                "message": _ISSUE_LABELS.get(t, t.replace("-", " ")),
                "detail": _issue_detail(issue, shape_titles),
            }
        )

    status = readiness.get("status")
    if not isinstance(status, str):
        status = "unknown"

    if status == "ready":
        summary = "TrackDraw overlay package is ready."
    elif issues:
        issue_names = ", ".join(issue["type"] for issue in issues)
        summary = f"Overlay package is blocked: {issue_names}."
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
        issue_types = ", ".join(
            i["type"]
            for i in (readiness.get("issues") or [])
            if isinstance(i, dict) and isinstance(i.get("type"), str)
        )
        state = "blocked"
        message = (
            f"Overlay package is not ready: {issue_types}."
            if issue_types
            else "Overlay package is not ready."
        )
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
    return {
        str(p["split_index"]): p["timing_id"].strip()
        for p in (readiness.get("timing_points") or [])
        if isinstance(p, dict)
        and p.get("role") == "split"
        and isinstance(p.get("split_index"), int)
        and not isinstance(p.get("split_index"), bool)
        and isinstance(p.get("timing_id"), str)
        and p.get("timing_id", "").strip()
    }


# ---- Store ----


class TrackDrawOverlayStore:
    """Fetch and cache a TrackDraw overlay package through RotorHazard config."""

    def __init__(self, rhapi: object) -> None:
        """Initialize the TrackDraw overlay store."""
        self._rhapi = rhapi
        self._session = requests.Session()

    def get_project_id(self) -> str:
        """Return the configured TrackDraw project id."""
        return _normalize(
            self._rhapi.config.get_item(TRACKDRAW_CONFIG_SECTION, PROJECT_ID_KEY)
        )

    def get_api_key(self) -> str:
        """Return the configured TrackDraw API key."""
        return _normalize(
            self._rhapi.config.get_item(TRACKDRAW_CONFIG_SECTION, API_KEY_KEY)
        )

    def has_config(self) -> bool:
        """Return whether the required TrackDraw credentials are configured."""
        return bool(self.get_project_id() and self.get_api_key())

    def _config_state(self) -> dict:
        """Return non-secret configuration state for diagnostics."""
        return {
            "has_project_id": bool(self.get_project_id()),
            "has_api_key": bool(self.get_api_key()),
        }

    def load_cache(self) -> dict | None:
        """Load the last-good-ready TrackDraw cache from RotorHazard options."""
        raw = _normalize(self._rhapi.db.option(CACHE_OPTION, ""))
        if not raw:
            return None
        try:
            cache = json.loads(raw)
        except (TypeError, ValueError):
            logger.warning("Ignoring invalid TrackDraw overlay cache")
            return None
        if isinstance(cache, dict) and isinstance(cache.get("package"), dict):
            return cache
        return None

    def save_cache(self, package: dict) -> dict:
        """Persist a last-good-ready overlay package for offline race-day use."""
        now = _utc_now()
        cache = {
            "cached_at": _to_iso(now),
            "package": package,
            "schema": "trackdraw.overlay.cache.v1",
            "source_updated_at": package.get("updated_at"),
        }
        self._rhapi.db.option_set(CACHE_OPTION, json.dumps(cache))
        return cache

    def _cache_age_seconds(self, cache: dict) -> int | None:
        """Return how many seconds old the cache is, or None if unparseable."""
        cached_at = _parse_iso(cache.get("cached_at", ""))
        if not cached_at:
            return None
        return max(0, int((_utc_now() - cached_at).total_seconds()))

    def _cache_is_fresh(self, cache: dict) -> bool:
        """Return whether the cache is within its freshness window."""
        age = self._cache_age_seconds(cache)
        return age is not None and age <= TRACKDRAW_CACHE_TTL_SECONDS

    def _cache_state(self, cache: dict) -> dict:
        """Return cache age and freshness metadata."""
        age = self._cache_age_seconds(cache)
        return {
            "cached_at": cache.get("cached_at"),
            "age_seconds": age,
            "source_updated_at": cache.get("source_updated_at"),
            "status": "fresh"
            if (age is not None and age <= TRACKDRAW_CACHE_TTL_SECONDS)
            else "stale",
        }

    def should_auto_refresh(self, cache: dict | None) -> bool:
        """Return whether the cache should be refreshed automatically."""
        return self.has_config() and (cache is None or not self._cache_is_fresh(cache))

    def _build_payload(
        self,
        cache: dict | None,
        error: TrackDrawClientError | None = None,
    ) -> dict:
        """Return the public overlay payload for a cached or error state."""
        if cache is not None:
            cache_state = self._cache_state(cache)
            payload: dict = {
                "ok": True,
                "state": cache_state["status"],
                "track": cache["package"],
                "cache": cache_state,
                "config": self._config_state(),
                "diagnostics": {
                    "readiness": get_readiness_diagnostics(cache["package"]),
                },
                "split_map": derive_split_map(cache["package"]),
            }
            if error is not None:
                payload["refresh_error"] = {
                    "state": error.state,
                    "message": error.message,
                    "diagnostics": {
                        "readiness": get_readiness_diagnostics(error.package),
                    },
                }
            return payload

        if error is not None:
            state = error.state
            message = error.message
            track = error.package
        elif self.has_config():
            state = "missing_cache"
            message = "No cached TrackDraw overlay package is available."
            track = None
        else:
            state = "missing_config"
            message = "Configure a TrackDraw project ID and API key."
            track = None

        return {
            "ok": False,
            "state": state,
            "track": track,
            "cache": None,
            "config": self._config_state(),
            "diagnostics": {"readiness": get_readiness_diagnostics(track)},
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
        return self._build_payload(cache)

    def get_payload(self, *, force_refresh: bool = False) -> dict:
        """Return a cached or freshly refreshed overlay payload."""
        cache = self.load_cache()

        if force_refresh or self.should_auto_refresh(cache):
            try:
                return self.refresh()
            except TrackDrawClientError as exc:
                return self._build_payload(cache, exc)

        return self._build_payload(cache)
