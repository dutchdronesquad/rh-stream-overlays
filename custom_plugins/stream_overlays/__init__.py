"""DDS - RotorHazard Stream Overlay Plugin."""

import functools
from collections.abc import Callable
from typing import Any

from eventmanager import Evt
from flask import abort, jsonify, templating
from flask.blueprints import Blueprint
from jinja2 import TemplateNotFound
from RHUI import UIField, UIFieldType

from .const import (
    API_KEY_KEY,
    PROJECT_ID_KEY,
    TRACKDRAW_CONFIG_SECTION,
)
from .trackdraw import TrackDrawOverlayStore
from .utils import (
    create_heat_markdown,
    create_leaderboard_markdown,
    create_nodes_markdown,
    create_topbar_markdown,
    create_trackdraw_markdown,
)

overlays: dict = {
    "DDS": {
        "node": True,
        "topbar": True,
        "leaderboard": True,
        "heat": True,
        "trackdraw_map": True,
    },
    "LCDR": {
        "node": True,
        "topbar": True,
        "leaderboard": False,
        "heat": True,
        "trackdraw_map": True,
    },
    "APEX": {
        "node": True,
        "topbar": True,
        "leaderboard": False,
        "heat": True,
        "trackdraw_map": True,
    },
}


class StreamOverlays:
    """Stream Overlays plugin class."""

    def __init__(self, rhapi: object) -> None:
        """Initialize StreamOverlays.

        Args:
        ----
            rhapi (RotorHazardAPI): RotorHazard API instance.

        """
        self._rhapi = rhapi
        self._overlays = overlays
        self._trackdraw = TrackDrawOverlayStore(rhapi)

    def get_trackdraw_payload(self, *, force_refresh: bool = False) -> dict:
        """Return the current TrackDraw overlay payload."""
        return self._trackdraw.get_payload(force_refresh=force_refresh)

    def refresh_trackdraw_cache(self, _args: dict | None = None) -> None:
        """Fetch TrackDraw data, update the cache, and notify the operator."""
        payload = self.get_trackdraw_payload(force_refresh=True)
        self._notify_trackdraw_refresh_result(payload)

    def sync_trackdraw_cache(self, _args: dict | None = None) -> None:
        """Automatically refresh TrackDraw data when configured."""
        cache = self._trackdraw.load_cache()
        if not self._trackdraw.should_auto_refresh(cache):
            return

        self.get_trackdraw_payload(force_refresh=False)

    def _get_trackdraw_readiness_message(self, payload: dict) -> str | None:
        """Return a compact readiness message from a TrackDraw payload."""
        diagnostics = payload.get("diagnostics")
        if not isinstance(diagnostics, dict):
            return None

        readiness = diagnostics.get("readiness")
        if not isinstance(readiness, dict) or not isinstance(
            readiness.get("summary"), str
        ):
            return None

        lines = [readiness["summary"]]
        issues = readiness.get("issues")
        if isinstance(issues, list):
            for issue in issues[:3]:
                if not isinstance(issue, dict):
                    continue

                message = issue.get("message")
                if not isinstance(message, str):
                    message = issue.get("type", "Readiness issue")

                detail = issue.get("detail")
                if isinstance(detail, str) and detail:
                    message = f"{message} ({detail})"

                lines.append(message)

        return " ".join(lines)

    def _notify_trackdraw_refresh_result(self, payload: dict) -> None:
        """Show a RotorHazard message for a manual TrackDraw refresh."""
        if payload.get("ok"):
            refresh_error = payload.get("refresh_error")
            if isinstance(refresh_error, dict):
                message = self._get_trackdraw_readiness_message(
                    refresh_error
                ) or refresh_error.get("message", "Refresh failed.")
                self._rhapi.ui.message_notify(
                    f"TrackDraw refresh failed; using cached package. {message}"
                )
                return

            cache = payload.get("cache")
            cached_at = (
                cache.get("cached_at")
                if isinstance(cache, dict) and isinstance(cache.get("cached_at"), str)
                else None
            )
            suffix = f" Cached at {cached_at}." if cached_at else ""
            self._rhapi.ui.message_notify(
                f"TrackDraw overlay package fetched and cached.{suffix}"
            )
            return

        error = self._get_trackdraw_readiness_message(payload) or payload.get(
            "error", "Check the TrackDraw project ID and API key."
        )
        self._rhapi.ui.message_alert(
            f"TrackDraw overlay package was not cached. {error}"
        )

    def register_trackdraw_settings(self) -> None:
        """Register TrackDraw integration settings."""
        panel_id = "stream_overlays_trackdraw"
        self._rhapi.config.register_section(TRACKDRAW_CONFIG_SECTION)
        self._rhapi.ui.register_panel(
            panel_id,
            "TrackDraw",
            "settings",
            open=False,
        )
        self._rhapi.fields.register_option(
            UIField(
                PROJECT_ID_KEY,
                "TrackDraw project ID",
                UIFieldType.TEXT,
                value="",
                desc="Copy this from the TrackDraw project details.",
                placeholder="project_123",
                persistent_section=TRACKDRAW_CONFIG_SECTION,
            ),
            panel=panel_id,
        )
        self._rhapi.fields.register_option(
            UIField(
                API_KEY_KEY,
                "TrackDraw API key",
                UIFieldType.PASSWORD,
                value="",
                desc="Stored only in RotorHazard and never sent to OBS overlays.",
                private=True,
                persistent_section=TRACKDRAW_CONFIG_SECTION,
            ),
            panel=panel_id,
        )
        self._rhapi.ui.register_quickbutton(
            panel=panel_id,
            name="refresh_trackdraw_cache",
            label="Fetch TrackDraw package",
            function=self.refresh_trackdraw_cache,
        )

    def startup(self, args: dict) -> None:
        """Create panels and run automatic TrackDraw sync."""
        self.create_panels(args)
        self.sync_trackdraw_cache(args)

    def create_panels(self, _args: dict) -> None:
        """Create the stream overlay panels.

        Args:
        ----
            _args: Arguments passed to function.

        """
        num_nodes: int = len(self._rhapi.interface.seats)
        race_classes: list = self._rhapi.db.raceclasses

        for overlay_name, features in self._overlays.items():
            base_path: str = f"/stream/overlay/{overlay_name.lower()}"

            # Register a panel for each overlay on the streams page
            panel_id = f"stream_overlays_{overlay_name.lower()}"
            self._rhapi.ui.register_panel(
                panel_id,
                f"{overlay_name} - OBS Overlays",
                "streams",
                open=False,
            )

            # Create and register markdown blocks based on the features
            if features.get("leaderboard"):
                leaderboard_markdown = create_leaderboard_markdown(
                    overlay_name, base_path, race_classes
                )
                self._rhapi.ui.register_markdown(
                    panel_id,
                    f"{overlay_name}-Leaderboard",
                    leaderboard_markdown,
                )

            if features.get("topbar"):
                topbar_markdown = create_topbar_markdown(overlay_name, base_path)
                self._rhapi.ui.register_markdown(
                    panel_id,
                    f"{overlay_name}-Topbar",
                    topbar_markdown,
                )

            if features.get("node"):
                nodes_markdown = create_nodes_markdown(
                    overlay_name, base_path, num_nodes
                )
                self._rhapi.ui.register_markdown(
                    panel_id, f"{overlay_name}-Nodes", nodes_markdown
                )

            if features.get("heat"):
                heat_markdown = create_heat_markdown(overlay_name, base_path)
                self._rhapi.ui.register_markdown(
                    panel_id, f"{overlay_name}-Heat", heat_markdown
                )

            if features.get("trackdraw_map"):
                trackdraw_markdown = create_trackdraw_markdown(overlay_name, base_path)
                self._rhapi.ui.register_markdown(
                    panel_id,
                    f"{overlay_name}-TrackDraw",
                    trackdraw_markdown,
                )


_OVERLAY_THEMES = frozenset(key.lower() for key in overlays)
_LEADERBOARD_THEMES = frozenset(
    key.lower() for key, features in overlays.items() if features.get("leaderboard")
)


def _render_overlay(template: str, **kwargs: object) -> str:
    """Render an overlay template, returning 404 if the template does not exist."""
    try:
        return templating.render_template(template, **kwargs)
    except TemplateNotFound:
        abort(404)


def require_theme(
    themes: frozenset[str] = _OVERLAY_THEMES,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Abort 404 when the `name` route parameter is not a supported theme."""

    def decorator(f: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(f)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            if kwargs.get("name") not in themes:
                abort(404)
            return f(*args, **kwargs)

        return wrapper

    return decorator


def initialize(rhapi: object) -> None:
    """Initialize the plugin.

    Args:
    ----
        rhapi (RotorHazardAPI): RotorHazard API instance.

    """
    stream_overlays = StreamOverlays(rhapi)
    stream_overlays.register_trackdraw_settings()

    # Hook into the startup event to create the panels
    rhapi.events.on(Evt.STARTUP, stream_overlays.startup)

    bp = Blueprint(
        "stream_overlays",
        __name__,
        template_folder="pages",
        static_folder="static",
        static_url_path="/stream_overlays/static",
    )

    @bp.route("/stream/overlay/<string:name>/node/<int:node_id>")
    @require_theme()
    def render_node_overlay(name: str, node_id: int) -> str:
        """Render the node overlay."""
        return _render_overlay(
            "overlays/node.html",
            serverInfo=None,
            getOption=rhapi.db.option,
            getConfig=rhapi.config.get_item,
            __=rhapi.__,
            theme_name=name,
            node_id=node_id - 1,
        )

    @bp.route("/stream/overlay/<string:name>/topbar")
    @require_theme()
    def render_topbar_overlay(name: str) -> str:
        """Render the topbar overlay."""
        return _render_overlay(
            "overlays/topbar.html",
            serverInfo=None,
            getOption=rhapi.db.option,
            getConfig=rhapi.config.get_item,
            __=rhapi.__,
            theme_name=name,
        )

    @bp.route("/stream/overlay/<string:name>/leaderboard/<int:class_id>/overall")
    @require_theme(_LEADERBOARD_THEMES)
    def render_overall_class_overlay(name: str, class_id: int) -> str:
        """Render the overall class leaderboard overlay."""
        return _render_overlay(
            "overlays/leaderboard-overall.html",
            serverInfo=None,
            getOption=rhapi.db.option,
            getConfig=rhapi.config.get_item,
            __=rhapi.__,
            theme_name=name,
            class_id=class_id,
        )

    @bp.route("/stream/overlay/<string:name>/leaderboard/<int:class_id>/class")
    @require_theme(_LEADERBOARD_THEMES)
    def render_class_leaderboard_overlay(name: str, class_id: int) -> str:
        """Render the class leaderboard overlay."""
        return _render_overlay(
            "overlays/leaderboard-class.html",
            serverInfo=None,
            getOption=rhapi.db.option,
            getConfig=rhapi.config.get_item,
            __=rhapi.__,
            theme_name=name,
            class_id=class_id,
        )

    @bp.route("/stream/overlay/<string:name>/heat/upcoming")
    @require_theme()
    def render_heat_overlay(name: str) -> str:
        """Render the upcoming heat overlay."""
        return _render_overlay(
            "overlays/heat.html",
            serverInfo=None,
            getOption=rhapi.db.option,
            getConfig=rhapi.config.get_item,
            __=rhapi.__,
            theme_name=name,
            num_nodes=len(rhapi.interface.seats),
        )

    @bp.route("/stream/overlay/<string:name>/trackdraw/map")
    @require_theme()
    def render_trackdraw_map(name: str) -> str:
        """Render the TrackDraw map overlay."""
        return _render_overlay(
            "overlays/trackdraw-map.html",
            serverInfo=None,
            getOption=rhapi.db.option,
            getConfig=rhapi.config.get_item,
            __=rhapi.__,
            theme_name=name,
        )

    @bp.route("/stream/overlay/<string:name>/trackdraw/overview")
    @require_theme()
    def render_trackdraw_overview(name: str) -> str:
        """Render the TrackDraw overview overlay."""
        return _render_overlay(
            "overlays/trackdraw-overview.html",
            serverInfo=None,
            getOption=rhapi.db.option,
            getConfig=rhapi.config.get_item,
            __=rhapi.__,
            theme_name=name,
        )

    @bp.route("/stream/overlay/<string:_name>/trackdraw/track.json")
    @bp.route("/stream/overlay/<string:_name>/trackdraw/overview/track.json")
    def get_trackdraw_track(_name: str) -> object:
        """Return cached TrackDraw overlay data for OBS/browser clients."""
        return jsonify(stream_overlays.get_trackdraw_payload(force_refresh=False))

    rhapi.ui.blueprint_add(bp)
