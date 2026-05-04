---
title: Performance Tips
description: OBS and browser-source performance guidance for Stream Overlays.
---

# Performance Tips

Stream Overlays uses browser sources, so performance depends on OBS settings, browser source count, and how much motion each scene contains.

## Browser source FPS

| Overlay | Recommended FPS | Reason |
|---------|-----------------|--------|
| Topbar | 60 | Smooth timer and ticker motion |
| Node overlay | 30 | Lap updates do not require constant high-frame animation |
| Upcoming heat | 15-30 | Mostly static content |
| Leaderboard | 30 | Occasional list transitions |
| TrackDraw map | 60 | Pilot movement is the main visual |
| TrackDraw overview | 60 | Map movement plus live sidebar state |

## Reduce active browser sources

- Build separate scenes instead of stacking every overlay into one scene.
- Enable **Shutdown source when not visible** for sources that do not need to keep running.
- Use nested scenes carefully; hidden nested browser sources can still cost resources.
- Prefer one full-screen overview source over many small browser sources for venue screens.

## Refresh behavior

Enable **Refresh browser when scene becomes active** for overlays that depend on current RotorHazard state. This is especially useful for:

- Upcoming heat boards.
- Leaderboards.
- TrackDraw map and overview scenes.
- Browser sources that are only shown between races.

## Hardware acceleration

OBS browser sources generally perform better with GPU acceleration enabled. After changing renderer or hardware acceleration settings, restart OBS before testing.

## Network stability

Use a wired connection between the stream PC and RotorHazard device when possible. Browser sources depend on the RotorHazard web server and Socket.IO updates, so Wi-Fi drops can look like frozen overlays.
