---
title: Release v1.5.0
description: >
  Release notes for v1.5.0
authors: [klaas]
date: 2026-05-10
categories:
  - Release
---

Stream Overlays v1.5.0 is here, and this release brings a new layer of race context to your broadcast. With the new TrackDraw integration, viewers can now follow pilot positions on a live track map while the race is running.

Alongside the new map and overview overlays, this release also rebuilds the frontend foundation behind the scenes. The result is a release that adds something very visible for stream viewers while making the project easier to maintain and extend.

<!-- more -->

## TrackDraw Integration

The biggest addition in this release is the new [TrackDraw integration](../../integrations/trackdraw/index.md). Stream Overlays can now load a published TrackDraw project through the RotorHazard plugin, cache the track package locally, and use RotorHazard timing data to animate pilots around the track in OBS.

That gives viewers a much clearer sense of where pilots are on the track, especially in heats where the video feed alone does not tell the full story. It also keeps the setup production-friendly: OBS reads the cached overlay data from RotorHazard, while your TrackDraw API key stays in the RotorHazard plugin settings.

!!! info "What is TrackDraw?"
    <a href="https://trackdraw.app" target="_blank" rel="noopener">
      <img class="trackdraw-logo trackdraw-logo--light" src="https://trackdraw.app/assets/brand/trackdraw-logo-color-lightbg.svg" alt="TrackDraw">
      <img class="trackdraw-logo trackdraw-logo--dark" src="https://trackdraw.app/assets/brand/trackdraw-logo-color-darkbg.svg" alt="TrackDraw">
    </a>

    [TrackDraw](https://trackdraw.app) is a browser-based FPV track planner. Race directors can draw a track to scale, place gates and timing points, review the flow in 3D, and share the same layout with pilots and crew.

    In practice, it turns the track plan into something reusable: a clear layout before race day, a reference for the build crew, and structured track data that can power live broadcast visuals.

### Race Map

The new **Live Race Map** is built for dedicated map scenes, compact corner maps, and side-by-side race layouts. It shows the TrackDraw route, gates, split markers, start/finish marker, and live pilot positions.

Pilot markers move from timing event to timing event and interpolate between known points, so the map stays readable and smooth instead of jumping only when RotorHazard receives a gate pass.

![TrackDraw map overlay preview](../../assets/img/overlays/apex/apex-trackdraw-map.gif){ style="border-radius: 5px;" }

Use this URL for the map:

```text
http://[RH-IP]:5000/stream/overlay/[theme]/trackdraw/map
```

Replace `[theme]` with `apex`, `dds`, or `lcdr`.

For smaller OBS sources, you can hide pilot labels with `?labels=0`:

```text
http://[RH-IP]:5000/stream/overlay/dds/trackdraw/map?labels=0
```

### Race Overview

This release also adds a new **TrackDraw Overview** overlay. It combines the live map with a leader callout, race status, and a pilot list, making it useful when the stream needs more context than a map-only source can provide.

![TrackDraw overview overlay preview](../../assets/img/overlays/apex/apex-trackdraw-overview.gif){ style="border-radius: 5px;" }

The overview is a good fit for commentator scenes, venue screens, break scenes, and analysis moments after a race. It listens to RotorHazard heat, race status, lap, and leaderboard updates. When ranking data is available, the pilot list follows leaderboard order; otherwise it falls back to node order.

Use this URL for the overview:

```text
http://[RH-IP]:5000/stream/overlay/[theme]/trackdraw/overview
```

Replace `[theme]` with `apex`, `dds`, or `lcdr`.

### Theme Support

TrackDraw is an integration, not a separate theme. You still choose a theme in the overlay URL, and Stream Overlays applies matching visual styling for the pilot badges and map details:

- **Apex** uses dark glass-style pilot badges with a full pilot-color border.
- **Dutch Drone Squad** uses the diagonal pill shape from the DDS overlay package.
- **LCDR** uses angular colored badges that match the LCDR theme.

The current leader receives a pulsing halo on the map, so commentators can quickly identify P1 during live racing.

## Rebuilt Frontend Foundation

The overlay frontend has been migrated to **Preact** and **Vite**. This replaces the older per-overlay JavaScript structure with reusable components, shared runtime parsing, normalized RotorHazard socket data, and a local overlay launcher for development.

For users, the important part is that the public OBS overlay URLs stay intact. For future development, this gives the project a cleaner base for new overlays, shared behavior, and theme-specific styling.

---

This release opens up a new way to show race flow, not just race timing. Try the Live Race Map in a dedicated scene, add the Race Overview to a production layout, and see which setup works best for your event.

If you have questions, feedback, or examples from your own stream setup, feel free to reach out to me on Discord (misternicolaz) or [GitHub](https://github.com/klaasnicolaas).

Happy live streaming!

./Klaas

<!-- Links -->
[issues]: https://github.com/dutchdronesquad/rh-stream-overlays/issues
