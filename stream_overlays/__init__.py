"""DDS - RotorHazard Stream Overlay Plugin"""
from eventmanager import Evt
from flask import templating
from flask.blueprints import Blueprint

overlays: list = ["DDS", "LCDR"]

class StreamOverlays():
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
        for name in self._overlays:
            markdown_block: str = ""
            base_path: str = f"/stream/overlay/{name.lower()}"

            # Register a panel for each overlay on the streams page
            panel_id = f"stream_overlays_{name.lower()}"
            self._rhapi.ui.register_panel(panel_id, f"{name} - OBS Overlays", "streams")

            # Create header and link for the topbar
            markdown_block += "## Topbar\n"
            markdown_block += f"- <a href='{base_path}/topbar' target='_blank'>{name} Overlay - Topbar</a>\n"

            # Create header and links for each node overlay (or mock nodes)
            markdown_block += "## Nodes\n"
            for i in range(num_nodes):
                markdown_block += f"- <a href='{base_path}/node/{i+1}' target='_blank'>{name} Overlay - Node {i+1}</a>\n"

            # Register the markdown block
            self._rhapi.ui.register_markdown(panel_id, f"{name}", markdown_block)

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
        'stream_overlays',
        __name__,
        template_folder='pages',
        static_folder='static',
        static_url_path='/stream_overlays/static'
    )

    @bp.route('/stream/overlay/<string:name>/node/<int:node_id>')
    def render_node_overlay(name: str, node_id: int):
        """Render the node overlay."""
        return templating.render_template(f'stream/overlays/node_{name}.html', serverInfo=None, getOption=rhapi.db.option, getConfig=rhapi.config.get_item, __=rhapi.__, node_id=node_id-1)

    @bp.route('/stream/overlay/<string:name>/topbar')
    def render_topbar_overlay(name: str):
        """Render the topbar overlay."""
        return templating.render_template(f'stream/topbars/topbar_{name}.html', serverInfo=None, getOption=rhapi.db.option, getConfig=rhapi.config.get_item, __=rhapi.__)

    @bp.route('/stream/overlay/<string:name>/leaderboard/<int:class_id>/overall')
    def render_overall_class_overlay(name: str, class_id: int):
        """Render the overall class leaderboard overlay."""
        return templating.render_template(f'stream/leaderboard/{name}/overall.html', serverInfo=None, getOption=rhapi.db.option, getConfig=rhapi.config.get_item, __=rhapi.__, class_id=class_id)

    @bp.route('/stream/overlay/<string:name>/leaderboard/<int:class_id>/class')
    def render_class_leaderboard_overlay(name: str, class_id: int):
        """Render the class leaderboard overlay."""
        return templating.render_template(f'stream/leaderboard/{name}/class.html', serverInfo=None, getOption=rhapi.db.option, getConfig=rhapi.config.get_item, __=rhapi.__, class_id=class_id)

    rhapi.ui.blueprint_add(bp)