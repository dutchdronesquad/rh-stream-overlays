---
title: Overview
description: TrackDraw overview overlay with live map, leader callout, and pilot list for commentator scenes.
---

# Overview

The Overview combines the TrackDraw map with a live leader callout and pilot list. It is designed for commentator views, break scenes, venue screens, and moments where viewers need more context than a small map overlay can provide.

!!! note "Requires TrackDraw"
    Configure the [TrackDraw integration](setup.md) before adding this overlay to OBS.

<!-- TODO: Add TrackDraw Overview GIF preview: ../../assets/img/integrations/trackdraw/trackdraw-overview.gif -->

## URL

```bash
http://[RH-IP]:5000/stream/overlay/[theme]/trackdraw/overview
```

Replace `[theme]` with `apex`, `dds`, or `lcdr`.

Examples:

```bash
http://192.168.1.100:5000/stream/overlay/apex/trackdraw/overview
http://192.168.1.100:5000/stream/overlay/dds/trackdraw/overview
http://192.168.1.100:5000/stream/overlay/lcdr/trackdraw/overview
```

## What it shows

| Area | Data |
|------|------|
| Track panel | TrackDraw route, gates, splits, and live pilot positions |
| Header | Track title and TrackDraw cache status |
| Race status | Idle, live, ended, or disconnected |
| Leader card | Current leader callsign |
| Pilot list | Up to eight active pilots with position, color, callsign, and node |

## OBS browser source settings

| Setting | Recommended value |
|---------|-------------------|
| Width | `1920` |
| Height | `1080` |
| FPS | `60` |
| Custom CSS | Leave empty |
| Shutdown source when not visible | Enabled |
| Refresh browser when scene becomes active | Enabled |

## Best uses

- Commentary scene before or during a race.
- Venue screen that needs map and ranking context.
- Break scene while pilots are staging.
- Dedicated analysis view after a race finishes.

## Data behavior

The overview listens to RotorHazard heat, race status, lap, and leaderboard updates. The pilot list sorts by leaderboard position when available and falls back to node order when ranking data has not arrived yet.

For map-only scenes, use the [Live Race Map](live-race-map.md).
