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

    @bp.route('/stream/overlay_1/node/<int:node_id>')
    def render_node_overlay_1(node_id):
        """Render node overlay option 1"""
        return templating.render_template('stream/overlays/option_1.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__, node_id=node_id-1)

    @bp.route('/stream/overlay_1/topbar')
    def render_topbar_overlay_1():
        """Render the topbar overlay option 1"""
        return templating.render_template('stream/topbars/option_1.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__)

    rhapi.ui.blueprint_add(bp)