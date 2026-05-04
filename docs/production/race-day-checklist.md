---
title: Race Day Checklist
description: Pre-event checklist for reliable RotorHazard overlays in OBS.
---

# Race Day Checklist

Run this checklist before opening the stream.

## RotorHazard

- Stream Overlays is installed and listed under plugins.
- The **Streams** page shows overlay links for the expected themes.
- Race classes, heats, pilots, callsigns, and colors are correct.
- Timing system is receiving laps from every node.
- Ranking mode is set correctly for any leaderboard scenes.

## TrackDraw

- Project ID and API key are configured.
- **Fetch TrackDraw package** succeeds.
- Route, gates, and splits look correct in the browser.
- Map movement matches timing events during a short test race.

## OBS

- Browser source URLs point to the correct RotorHazard IP address.
- Browser source dimensions match the intended layout.
- **Shutdown source when not visible** is enabled where practical.
- **Refresh browser when scene becomes active** is enabled for live-data scenes.
- Topbar, node, heat, leaderboard, map, and overview scenes all refresh cleanly.

## Stream output

- Canvas and output resolution are correct.
- Audio and video sync are verified.
- Scene transitions do not restart critical sources unnecessarily.
- A fallback scene is ready if the map or timing data is unavailable.
