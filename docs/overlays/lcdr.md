---
title: LCDR
description: Liga Colombiana Drone Racing overlay theme for RotorHazard streams.
---

# Liga Colombiana Drone Racing

This theme is designed by the <a href="https://ligacolombianadroneracing.com" target="_blank">Liga Colombiana Drone Racing</a> and consists of a top bar and a node overlay.

## Theme highlights

- **League-branded palette**: Fonts, colors, and iconography are tailored to LCDR so the overlay matches slides, banners, and on-site visuals.
- **Dynamic timing**: Heat labels auto-update with RotorHazard, keeping the stream lower-third current without manual edits.
- **Pilot-first node**: Lap number, total, and per-lap timing stay readable thanks to the card layout and adaptive pilot colors.
- **Lightweight setup**: Only two overlay URLs are needed, allowing you to switch between Dutch Drone Squad and LCDR events without rebuilding your OBS scenes.

## Topbar

The title in the top bar consists of a heat name that changes dynamically and the organization name of LCDR (static). It is slightly taller than the DDS topbar to emphasize the LCDR crest.

URL to use:

```bash
RH-IP:5000/stream/overlay/lcdr/topbar
```

![LCDR topbar overlay preview](../assets/img/overlays/lcdr/lcdr-topbar.gif)

## Node

The node overlay shows the pilot name, lap time, total time and lap number. The color of the node changes based on what is set in RotorHazard for each pilot. Replace `[NUMBER]` with the node id you want to show.

URL to use:

```bash
RH-IP:5000/stream/overlay/lcdr/node/[NUMBER]
```

![LCDR node overlay preview](../assets/img/overlays/lcdr/lcdr-node.gif)
