---
title: OBS Scene Layouts
description: Recommended OBS scene recipes for Stream Overlays, TrackDraw maps, topbars, nodes, and leaderboards.
---

# OBS Scene Layouts

Use these recipes as starting points for an OBS scene collection. They keep setup repeatable and avoid running more browser sources than needed.

## Recommended scene collection

```text
Scenes
├── Intro
├── Race - Matrix
├── Race - Node 1
├── Race - Node 2
├── Race - Node 3
├── Race - Node 4
├── Race - Map
├── Race - Overview
├── Heat Board
└── Results
```

## Race matrix

Use this when you want to show multiple pilot cameras at once.

```text
┌──────────────────────────────────────┐
│ Topbar                               │
├──────────────────┬───────────────────┤
│ Node 1 + cam     │ Node 2 + cam      │
├──────────────────┼───────────────────┤
│ Node 3 + cam     │ Node 4 + cam      │
└──────────────────┴───────────────────┘
```

Recommended sources:

| Source | Size | FPS |
|--------|------|-----|
| Topbar | `1920 x 100` | 60 |
| Node overlays | Match each camera crop | 30 |
| Pilot cameras | Match layout cells | Camera native |

## Dedicated map scene

Use the [Live Race Map](../integrations/trackdraw/live-race-map.md) as a full-screen source during races or between camera cuts.

```text
┌──────────────────────────────────────┐
│                                      │
│             Live Race Map            │
│             1920 x 1080              │
│                                      │
└──────────────────────────────────────┘
```

Recommended source:

```bash
http://[RH-IP]:5000/stream/overlay/dds/trackdraw/map
```

## Corner map overlay

Use a smaller map alongside pilot cameras. Add `?labels=0` when callsign badges are too dense.

```text
┌──────────────────────────────────────┐
│ Topbar                               │
├───────────┬───────────┬──────────────┤
│ Node 1    │ Node 2    │              │
│           │           │ Race Map     │
├───────────┼───────────┤ 480 x 270    │
│ Node 3    │ Node 4    │              │
│           │           │              │
└───────────┴───────────┴──────────────┘
```

Recommended source:

```bash
http://[RH-IP]:5000/stream/overlay/dds/trackdraw/map?labels=0
```

## TrackDraw overview

Use the [Overview](../integrations/trackdraw/overview.md) as a commentator or venue-screen scene.

```text
┌──────────────────────────────────────┐
│ Track title                  Status  │
├──────────────────────────┬───────────┤
│                          │ Leader    │
│      Live Race Map       ├───────────┤
│                          │ Pilots    │
└──────────────────────────┴───────────┘
```

Recommended source:

```bash
http://[RH-IP]:5000/stream/overlay/dds/trackdraw/overview
```

## Heat board

Use upcoming heat overlays before the next race starts.

```bash
http://[RH-IP]:5000/stream/overlay/apex/heat/upcoming
http://[RH-IP]:5000/stream/overlay/dds/heat/upcoming
http://[RH-IP]:5000/stream/overlay/lcdr/heat/upcoming
```

## Results scene

DDS currently includes class and overall leaderboard overlays.

```bash
http://[RH-IP]:5000/stream/overlay/dds/leaderboard/0/class
http://[RH-IP]:5000/stream/overlay/dds/leaderboard/0/overall
```

Use `0` for the current class or replace it with a fixed RotorHazard class ID.
