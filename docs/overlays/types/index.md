---
title: Overlay Types
description: Functional overview of Stream Overlays browser source types.
---

# Overlay Types

Overlay types describe what an OBS browser source shows. Themes describe how that source looks.

| Type | Available themes | URL pattern |
|------|------------------|-------------|
| [Node Overlays](nodes.md) | Apex, DDS, LCDR | `/stream/overlay/[theme]/node/[node]` |
| [Topbars](topbars.md) | Apex, DDS, LCDR | `/stream/overlay/[theme]/topbar` |
| [Upcoming Heat](upcoming-heat.md) | Apex, DDS, LCDR | `/stream/overlay/[theme]/heat/upcoming` |
| [Leaderboards](leaderboards.md) | DDS | `/stream/overlay/dds/leaderboard/[class-id]/[mode]` |

TrackDraw map and overview overlays are documented under [Integrations](../../integrations/trackdraw/index.md), because they require external TrackDraw setup.
