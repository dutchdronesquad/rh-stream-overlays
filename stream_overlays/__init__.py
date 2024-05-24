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