---
title: TrackDraw Setup
description: Configure the TrackDraw project ID, API key, cache, and readiness checks for Stream Overlays.
---

# TrackDraw Setup

Configure TrackDraw once in RotorHazard before using the map or overview overlays in OBS.

## Before you start

Prepare these values from TrackDraw:

| Value | Purpose |
|-------|---------|
| Project ID | Identifies the published track package |
| API key | Allows RotorHazard to fetch the project package |

The API key is stored in RotorHazard and is not sent to OBS browser sources.

## Configure RotorHazard

1. Open RotorHazard.
2. Go to **Settings**.
3. Find **TrackDraw**.
4. Enter the **TrackDraw project ID**.
5. Enter the **TrackDraw API key**.
6. Click **Fetch TrackDraw package**.

After a successful fetch, the plugin stores a cached package. OBS overlays read from that cache, so the browser source can keep working without calling TrackDraw directly.

## Verify the integration

Use this checklist before race day:

- The fetch button reports that the TrackDraw package was fetched and cached.
- The map overlay loads without a setup warning.
- The route, gates, and split markers appear in the correct locations.
- Pilots appear when a heat is staged or started.
- Pilot movement reaches the expected gate or split after timing events.

## Common setup issues

??? question "Package unavailable"

    The overlay says the TrackDraw package is unavailable.

    - **Cause:** RotorHazard does not have a cached TrackDraw package yet.
    - **Fix:** check the project ID and API key, then click **Fetch TrackDraw package** again.

??? question "Pilot movement is wrong"

    The track renders, but pilots move to the wrong part of the route.

    - **Cause:** TrackDraw timing markers do not match the RotorHazard timing events.
    - **Fix:** check the start/finish marker and split marker order in TrackDraw.

??? question "OBS shows an old track"

    OBS still shows an older route, gate layout, or marker position.

    - **Cause:** the cached package has not been refreshed after publishing TrackDraw changes.
    - **Fix:** publish the latest TrackDraw project, then click **Fetch TrackDraw package** in RotorHazard.

??? question "Works in browser, not in OBS"

    The overlay works in a normal browser but not in OBS.

    - **Cause:** OBS may be using stale browser source cache, or the stream PC cannot reach the RotorHazard URL.
    - **Fix:** refresh the OBS browser source, enable **Refresh browser when scene becomes active**, and confirm the overlay URL opens from the stream PC.

## Cache behavior

The plugin caches the TrackDraw package inside RotorHazard. Refresh the cache when:

- You publish a new TrackDraw version.
- Gate or split positions change.
- The project ID changes.
- A readiness warning mentions stale or missing data.

## Security note

OBS receives only the cached overlay data from RotorHazard. Keep the TrackDraw API key in RotorHazard settings and do not add it to overlay URLs or OBS custom CSS.
