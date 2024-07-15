"""DDS - RotorHazard Stream Overlay Plugin"""

from eventmanager import Evt
from flask import templating
from flask.blueprints import Blueprint
from .utils import (
    create_nodes_markdown,
    create_topbar_markdown,
    create_leaderboard_markdown,
)

overlays: dict = {
    "DDS": {"node": True, "topbar": True, "leaderboard": True},
    "LCDR": {"node": True, "topbar": True, "leaderboard": False},
}


class StreamOverlays:
    """Stream Overlays plugin class."""

    def __init__(self, rhapi):
        """Initialize StreamOverlays.

        Args:
        -----
            rhapi (RotorHazardAPI): RotorHazard API instance.
        """
        self._rhapi = rhapi
        self._overlays = overlays

    def create_panels(self, _args) -> None:
        """Create the stream overlay panels.
        Args:
        -----
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
                open=True,
            )

            # Create and register markdown blocks based on the features
            if features.get("leaderboard"):
                leaderboard_markdown = create_leaderboard_markdown(overlay_name, base_path, race_classes)
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
                nodes_markdown = create_nodes_markdown(overlay_name, base_path, num_nodes)
                self._rhapi.ui.register_markdown(
                    panel_id, f"{overlay_name}-Nodes", nodes_markdown
                )


def initialize(rhapi):
    """Initialize the plugin.

    Args:
    -----
        rhapi (RotorHazardAPI): RotorHazard API instance.
    """
    stream_overlays = StreamOverlays(rhapi)

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
    def render_node_overlay(name: str, node_id: int):
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
    def render_topbar_overlay(name: str):
        """Render the topbar overlay."""
        return templating.render_template(
            f"stream/topbars/topbar_{name}.html",
            serverInfo=None,
            getOption=rhapi.db.option,
            getConfig=rhapi.config.get_item,
            __=rhapi.__,
        )

    @bp.route("/stream/overlay/<string:name>/leaderboard/<int:class_id>/overall")
    def render_overall_class_overlay(name: str, class_id: int):
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
    def render_class_leaderboard_overlay(name: str, class_id: int):
        """Render the class leaderboard overlay."""
        return templating.render_template(
            f"stream/leaderboard/{name}/class.html",
            serverInfo=None,
            getOption=rhapi.db.option,
            getConfig=rhapi.config.get_item,
            __=rhapi.__,
            class_id=class_id,
        )

    rhapi.ui.blueprint_add(bp)
