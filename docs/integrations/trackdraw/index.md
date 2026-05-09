---
title: TrackDraw Integration
description: Configure TrackDraw data for live map and overview overlays.
---

# TrackDraw Integration

The [TrackDraw](https://trackdraw.app) integration adds live track-position overlays to Stream Overlays. It fetches a published TrackDraw project through the RotorHazard plugin, caches the track package, and lets OBS render race positions without exposing your TrackDraw API key to the browser source.

TrackDraw is an integration, not a theme. You still choose a theme in the overlay URL so pilot badges and map styling match the rest of your broadcast package.

## What it adds

### Live Race Map

Use the [Live Race Map](live-race-map.md) for fullscreen race maps or compact map overlays.

![TrackDraw map overlay preview](../../assets/img/overlays/apex/apex-trackdraw-map.gif)

!!! note "Preview performance"
    The live overlay runs much smoother in OBS or a browser than this GIF preview. GIF compression and frame-rate limits make the map movement look slower and less fluid.

```text
/stream/overlay/[theme]/trackdraw/map
```

#### Path placeholders

Use the path placeholder to choose which overlay theme should render the map and pilot badges.

| Placeholder | Values | Description |
|-------------|--------|-------------|
| `[theme]` | `apex`, `dds`, `lcdr` | Selects the visual theme for pilot badges and map styling. |

#### Query parameters

Use query parameters to adjust map-only behavior for the OBS source size.

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `labels` | `0` | Labels shown | Hides pilot callsign badges. Useful for compact map sources. |

Examples:

```bash
http://[RH-IP]:5000/stream/overlay/apex/trackdraw/map
http://[RH-IP]:5000/stream/overlay/dds/trackdraw/map?labels=0
```

### Overview

Use the [Overview](overview.md) for commentator scenes with a map, leader callout, and pilot list.

![TrackDraw overview overlay preview](../../assets/img/overlays/apex/apex-trackdraw-overview.gif)

```text
/stream/overlay/[theme]/trackdraw/overview
```

#### Path placeholders

Use the path placeholder to choose which overlay theme should render the overview.

| Placeholder | Values | Description |
|-------------|--------|-------------|
| `[theme]` | `apex`, `dds`, `lcdr` | Selects the visual theme for the map, leader card, and pilot list. |

Example:

```bash
http://[RH-IP]:5000/stream/overlay/apex/trackdraw/overview
```

## How the data flow works

1. Configure your TrackDraw project ID and API key in RotorHazard.
2. The plugin fetches and caches the TrackDraw package.
3. OBS opens a browser source for the TrackDraw overlay URL.
4. The overlay loads the cached TrackDraw route, gates, and marker data from RotorHazard.
5. RotorHazard timing events drive pilot movement and leaderboard state in real time.

## Requirements

- A TrackDraw account with a published project.
- A valid TrackDraw project ID.
- A TrackDraw API key.
- RotorHazard with Stream Overlays plugin installed.
- Timing markers in TrackDraw that match the RotorHazard start/finish and split setup.

## Theme styling

TrackDraw overlays use shared map templates with theme-specific styling:

| Theme | Pilot badge style |
|-------|-------------------|
| Apex | Dark glass card with a full pilot-color border |
| DDS | Colored diagonal pill with rounded opposite corners |
| LCDR | Angular colored badge with square corners |

The leader pilot receives a pulsing halo so commentators can identify P1 quickly.

## Next steps

- Follow the [TrackDraw setup guide](setup.md) to connect the project.
- Add the [Live Race Map](live-race-map.md) to OBS for map-only scenes.
- Use the [Overview](overview.md) for commentator or break scenes.
