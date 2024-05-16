"""DDS - RotorHazard Stream Overlay Plugin"""
from eventmanager import Evt
from flask import templating
from flask.blueprints import Blueprint

overlays: list = ["DDS", "LCDR"]

class StreamOverlays():
    """Stream Overlays class."""

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
            # Register a panel for each overlay on the streams page
            self._rhapi.ui.register_panel(f"stream_overlays_{name.lower()}", f"{name} - OBS Overlays", "streams")
            # Generate link for the topbar
            self._rhapi.ui.register_link(f"stream_overlays_{name.lower()}", f"{name} Overlay - Topbar", f"/stream/overlay/{name.lower()}/topbar")
            # Generate link for each node or mock the number of nodes
            for i in range(num_nodes):
                self._rhapi.ui.register_link(f"stream_overlays_{name.lower()}", f"{name} Overlay - Node {i+1}", f"/stream/overlay/{name.lower()}/node/{i+1}")

def initialize(rhapi):
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