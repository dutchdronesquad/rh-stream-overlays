---
title: Live Race Map
description: Real-time FPV race track map overlay for OBS using RotorHazard timing data and TrackDraw geometry.
---

# Live Race Map

The Live Race Map is a real-time FPV race track overlay. It fetches the cached track layout from RotorHazard and uses timing events to animate each pilot as a colored arrow moving around the track.

!!! note "Requires TrackDraw"
    Configure the [TrackDraw integration](setup.md) before adding this overlay to OBS.

<!-- TODO: Add Live Race Map GIF preview: ../../assets/img/integrations/trackdraw/trackdraw-map.gif -->

## How it works

1. On load, the overlay fetches the cached track layout from RotorHazard.
2. Pilot markers appear when the heat starts and hold at start/finish until holeshot is confirmed.
3. Each RotorHazard gate pass moves the pilot to the matching position on the track.
4. Between timing events, the overlay interpolates movement using a learned pace model.
5. Pilots fade after a stale window when no timing data is received.

## URL

```bash
http://[RH-IP]:5000/stream/overlay/[theme]/trackdraw/map
```

Replace `[theme]` with `apex`, `dds`, or `lcdr`.

Examples:

```bash
http://192.168.1.100:5000/stream/overlay/apex/trackdraw/map
http://192.168.1.100:5000/stream/overlay/dds/trackdraw/map
http://192.168.1.100:5000/stream/overlay/lcdr/trackdraw/map
```

## Query parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| `labels` | `0` | Hides pilot callsign badges. Useful for compact map overlays. |

Example without labels:

```bash
http://[RH-IP]:5000/stream/overlay/dds/trackdraw/map?labels=0
```

## OBS browser source settings

| Setting | Recommended value |
|---------|-------------------|
| Width | Match your OBS canvas for fullscreen, or use a fixed map-overlay size |
| Height | Match your OBS canvas for fullscreen, or use a fixed map-overlay size |
| FPS | `60` for smooth pilot movement |
| Custom CSS | Leave empty |
| Shutdown source when not visible | Enabled |
| Refresh browser when scene becomes active | Enabled |

## Production uses

| Use case | Recommended source size | Notes |
|----------|-------------------------|-------|
| Fullscreen race map | `1920 x 1080` | Use as a dedicated race or commentator scene |
| Corner map overlay | `480 x 270` | Add `?labels=0` when labels become cluttered |
| Square map overlay | `400 x 400` | Useful for compact tracks with empty 16:9 margins |
| Side-by-side with leaderboard | `960 x 960` | Crop or position alongside a standings source |

See [OBS Scene Layouts](../../production/obs-scene-layouts.md) for complete scene recipes.

## Readability tips

- Hide labels below roughly 400 px wide.
- Use a square browser source for compact tracks.
- Crop empty track margins in OBS with **Edit Transform**.
- Keep the source at 60 FPS; map motion is the main visual.
- Refresh the TrackDraw cache after editing the route or timing markers.
