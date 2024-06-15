"""Utility functions for stream overlays."""


def create_topbar_markdown(overlay_name: str, base_path: str) -> str:
    """Create header, link and markdown block for the topbar.

    Args:
    -----
        overlay_name (str): Name of the overlay.
        base_path (str): Base path for the overlay.

    Returns:
    --------
        str: Markdown block for the topbar.
    """
    topbar_markdown: str = "## Topbar\n"
    topbar_markdown += f"- <a href='{base_path}/topbar' target='_blank'>{overlay_name} Overlay - Topbar</a>\n"
    return topbar_markdown


def create_nodes_markdown(overlay_name: str, base_path: str, num_nodes: int) -> str:
    """Create header, links and markdown block for each node overlay (or mock nodes).

    Args:
    -----
        overlay_name (str): Name of the overlay.
        base_path (str): Base path for the overlay.
        num_nodes (int): Number of nodes.

    Returns:
    --------
        str: Markdown block for the nodes.
    """
    nodes_markdown: str = "## Nodes\n"
    for i in range(num_nodes):
        nodes_markdown += f"- <a href='{base_path}/node/{i+1}' target='_blank'>{overlay_name} Overlay - Node {i+1}</a>\n"
    return nodes_markdown


def create_leaderboard_markdown(
    overlay_name: str,
    base_path: str,
    race_classes: list,
) -> str:
    """Create leaderboard markdown block.

    Args:
    -----
        overlay_name (str): Name of the overlay.
        base_path (str): Base path for the overlay.
        race_clases (list): All available race classes.

    Returns:
    --------
        str: Markdown block for the leaderboard.
    """
    leaderboard_markdown: str = "## Leaderboard / Class\n"
    # Create links for overall and class leaderboards
    leaderboard_markdown += f"- <a href='{base_path}/leaderboard/0/overall' target='_blank'>{overlay_name} Overlay - Current / Overall Leaderboard</a>\n"
    leaderboard_markdown += f"- <a href='{base_path}/leaderboard/0/class' target='_blank'>{overlay_name} Overlay - Current Class</a>\n"

    # Create link for specific class
    for race_class in race_classes:
        leaderboard_markdown += f"- <a href='{base_path}/leaderboard/{race_class.id}/class' target='_blank'>{overlay_name} Overlay - {race_class.name}</a>\n"
    return leaderboard_markdown
