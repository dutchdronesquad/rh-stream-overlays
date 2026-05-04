---
title: Upcoming Heat
description: Upcoming heat overlay URLs and usage guidance.
---

# Upcoming Heat

Upcoming heat overlays show the active heat, pilot lineup, node assignments, and frequency/channel information. Use them before a race starts or during breaks.

## URL

```bash
http://[RH-IP]:5000/stream/overlay/[theme]/heat/upcoming
```

Replace `[theme]` with `apex`, `dds`, or `lcdr`.

Examples:

```bash
http://192.168.1.100:5000/stream/overlay/apex/heat/upcoming
http://192.168.1.100:5000/stream/overlay/dds/heat/upcoming
http://192.168.1.100:5000/stream/overlay/lcdr/heat/upcoming
```

## Best uses

- Pre-heat announcement scenes.
- Intermission scenes between heats.
- Venue screens before pilots launch.

## OBS guidance

Use a full-canvas browser source for the cleanest layout. Upcoming heat overlays are mostly static, so 15-30 FPS is usually enough.
