"""DDS - RotorHazard Stream Overlay Plugin."""

from eventmanager import Evt
from flask import jsonify, request, templating
from flask.blueprints import Blueprint
from RHUI import UIField, UIFieldType

from .trackdraw import (
    API_KEY_OPTION,
    PROJECT_ID_OPTION,
    TrackDrawOverlayStore,
)
from .utils import (
    create_heat_markdown,
    create_leaderboard_markdown,
    create_nodes_markdown,
    create_topbar_markdown,
    create_trackdraw_minimap_markdown,
)

overlays: dict = {
    "DDS": {
        "node": True,
        "topbar": True,
        "leaderboard": True,
        "heat": True,
        "trackdraw_minimap": True,
    },
    "LCDR": {
        "node": True,
        "topbar": True,
        "leaderboard": False,
        "heat": True,
        "trackdraw_minimap": True,
    },
    "APEX": {
        "node": True,
        "topbar": True,
        "leaderboard": False,
        "heat": True,
        "trackdraw_minimap": True,
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

    def register_trackdraw_settings(self) -> None:
        """Register TrackDraw integration settings."""
        panel_id = "stream_overlays_trackdraw"
        self._rhapi.ui.register_panel(
            panel_id,
            "TrackDraw - Live Minimap",
            "streams",
            open=False,
        )
        self._rhapi.fields.register_option(
            UIField(
                PROJECT_ID_OPTION,
                "TrackDraw project ID",
                UIFieldType.TEXT,
                desc="Copy this from the TrackDraw project export panel.",
                placeholder="project_123",
            ),
            panel=panel_id,
        )
        self._rhapi.fields.register_option(
            UIField(
                API_KEY_OPTION,
                "TrackDraw API key",
                UIFieldType.PASSWORD,
                desc="Stored only in RotorHazard and never sent to OBS overlays.",
            ),
            panel=panel_id,
        )

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

            if features.get("trackdraw_minimap"):
                minimap_markdown = create_trackdraw_minimap_markdown(
                    overlay_name, base_path
                )
                self._rhapi.ui.register_markdown(
                    panel_id,
                    f"{overlay_name}-TrackDraw-Minimap",
                    minimap_markdown,
                )


def initialize(rhapi: object) -> None:
    """Initialize the plugin.

    Args:
    ----
        rhapi (RotorHazardAPI): RotorHazard API instance.

    """
    stream_overlays = StreamOverlays(rhapi)
    stream_overlays.register_trackdraw_settings()

    # Hook into the startup event to create the panels
    rhapi.events.on(Evt.STARTUP, stream_overlays.create_panels)

    bp = Blueprint(
        "stream_overlays",
        __name__,
        template_folder="pages",
        static_folder="static",
        static_url_path="/stream_overlays/static",
    )

    @bp.route("/stream/overlay/<string:name>/node/<int:node_id>")
    def render_node_overlay(name: str, node_id: int) -> str:
        """Render the node overlay."""
        return templating.render_template(
            f"stream/nodes/node_{name}.html",
            serverInfo=None,
            getOption=rhapi.db.option,
            getConfig=rhapi.config.get_item,
            __=rhapi.__,
            node_id=node_id - 1,
        )

    @bp.route("/stream/overlay/<string:name>/topbar")
    def render_topbar_overlay(name: str) -> str:
        """Render the topbar overlay."""
        return templating.render_template(
            f"stream/topbars/topbar_{name}.html",
            serverInfo=None,
            getOption=rhapi.db.option,
            getConfig=rhapi.config.get_item,
            __=rhapi.__,
        )

    @bp.route("/stream/overlay/<string:name>/leaderboard/<int:class_id>/overall")
    def render_overall_class_overlay(name: str, class_id: int) -> str:
        """Render the overall class leaderboard overlay."""
        return templating.render_template(
            f"stream/leaderboard/{name}/overall.html",
            serverInfo=None,
            getOption=rhapi.db.option,
            getConfig=rhapi.config.get_item,
            __=rhapi.__,
            class_id=class_id,
        )

    @bp.route("/stream/overlay/<string:name>/leaderboard/<int:class_id>/class")
    def render_class_leaderboard_overlay(name: str, class_id: int) -> str:
        """Render the class leaderboard overlay."""
        return templating.render_template(
            f"stream/leaderboard/{name}/class.html",
            serverInfo=None,
            getOption=rhapi.db.option,
            getConfig=rhapi.config.get_item,
            __=rhapi.__,
            class_id=class_id,
        )

    @bp.route("/stream/overlay/<string:name>/heat/upcoming")
    def render_heat_overlay(name: str) -> str:
        """Render the upcoming heat overlay."""
        return templating.render_template(
            f"stream/heat/heat_{name}.html",
            serverInfo=None,
            getOption=rhapi.db.option,
            getConfig=rhapi.config.get_item,
            __=rhapi.__,
            num_nodes=len(rhapi.interface.seats),
        )

    @bp.route("/stream/overlay/<string:name>/trackdraw/minimap")
    def render_trackdraw_minimap(name: str) -> str:
        """Render the TrackDraw minimap overlay."""
        return templating.render_template(
            "stream/trackdraw/minimap.html",
            serverInfo=None,
            getOption=rhapi.db.option,
            getConfig=rhapi.config.get_item,
            __=rhapi.__,
            theme_name=name,
        )

    @bp.route("/stream/overlay/<string:_name>/trackdraw/track.json")
    def get_trackdraw_track(_name: str) -> object:
        """Return cached TrackDraw overlay data for OBS/browser clients."""
        force_refresh = request.args.get("refresh") == "1"
        return jsonify(
            stream_overlays.get_trackdraw_payload(force_refresh=force_refresh)
        )

    rhapi.ui.blueprint_add(bp)
