---
title: Apex
description: Apex overlay theme for RotorHazard streams with a floating position badge.
---

# Apex

Apex is a high-contrast, glassy theme inspired by esports broadcasts. It focuses on bold typography, a floating position badge, and a compact lap history so single-pilot cameras can look premium without complicated scene setup. Apex works particularly well for streams where each pilot gets their own scene and you want the overlay to feel like part of the graphics package rather than an afterthought.

## Theme highlights

- **Floating rank badge**: A standalone position banner anchors to the top-left corner and scales with your canvas. The ordinal suffix mirrors the same glow so the badge stays readable on ultrawide crops.
- **Glassmorphism cards**: Lap data and totals live inside frosted cards with accent lighting that inherits each pilot color. This creates depth without adding heavy gradients to your OBS layout.
- **Animated lap feed**: New laps slide in with motion + highlighting, and fastest laps stay pinned with color cues. The animation is subtle enough for long races but gives the audience clear feedback.
- **Minimal setup**: With only two overlay URLs (topbar + node), Apex is a quick drop-in for events that need a cohesive look without configuring leaderboards or extra scenes.

!!! note "Available overlays"
    Apex currently ships with a **node overlay**, **topbar**, and a matching **upcoming heat** board. Leaderboard layouts are still on the backlog.

## Topbar

The Apex topbar mirrors broadcast tickers, showing the active heat, event name, and timer information inside a single metallic strip.

URL to use:

```bash
RH-IP:5000/stream/overlay/apex/topbar
```

![Apex topbar overlay preview](../assets/img/overlays/apex/apex-topbar.gif)

## Upcoming heat

Want a true broadcast slate that floats above whatever background or camera feed you throw at it? The new Apex upcoming heat layout keeps everything in a single glass panel: headline + chips on top, then portrait seat cards inspired by DDR’s “Next Up” board. Drop it over venue photos, jib shots, or animated loops — the gradient glass keeps text readable without forcing a specific backplate.

- Glass board with subtle blur so any background/video works behind it (scaled to fit 720p/1080p canvases)
- Seat cards line up to four columns, each with a circular seat badge, pilot name, and channel block for fast scanning
- Meta chips collapse automatically if you don’t have class/round info

URL to use:

```bash
RH-IP:5000/stream/overlay/apex/heat/upcoming
```

Use it as a projector scene, a mini picture-in-picture overlay, or a standby card before the green flag.

## Node

The node overlay combines the floating position badge, pilot info card, and animated lap list. The accent bar at the base pulses with the pilot color to keep OBS scenes lively even during longer heats. Replace `[NUMBER]` with the node id you want to show.

URL to use:

```bash
RH-IP:5000/stream/overlay/apex/node/[NUMBER]
```

![Apex node overlay preview](../assets/img/overlays/apex/apex-node.gif)
