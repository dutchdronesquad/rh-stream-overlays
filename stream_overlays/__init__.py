"""DDS - RotorHazard Stream Overlay Plugin"""
from flask import templating
from flask.blueprints import Blueprint

def initialize(rhapi):
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
        return templating.render_template(f'stream/overlays/node_{name}.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__, node_id=node_id-1)

    @bp.route('/stream/overlay/<string:name>/topbar')
    def render_topbar_overlay(name: str):
        """Render the topbar overlay."""
        return templating.render_template(f'stream/topbars/topbar_{name}.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__)

    rhapi.ui.blueprint_add(bp)