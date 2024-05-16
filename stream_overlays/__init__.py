"""DDS - RotorHazard Stream Overlay Plugin"""
from flask import templating
from flask.blueprints import Blueprint

overlays: list = ["DDS", "LCDR"]
nr_of_mocks: int = 8

def initialize(rhapi):
    nodes: int = rhapi.race.slots

    for name in overlays:
        # Register a panel for each overlay on the streams page
        rhapi.ui.register_panel(f"stream_overlays_{name.lower()}", f"{name} - OBS Overlays", "streams")
        # Generate link for the topbar
        rhapi.ui.register_link(f"stream_overlays_{name.lower()}", f"{name} Overlay - Topbar", f"/stream/overlay/{name.lower()}/topbar")
        # Generate link for each node or mock the number of nodes
        for i in range(nodes if nodes > 0 else nr_of_mocks):
            rhapi.ui.register_link(f"stream_overlays_{name.lower()}", f"{name} Overlay - Node {i+1}", f"/stream/overlay/{name.lower()}/node/{i+1}")

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