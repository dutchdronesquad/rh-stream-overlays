---
title: Node Overlays
description: Per-pilot node overlay URLs and usage guidance.
---

# Node Overlays

Node overlays show pilot identity, lap timing, position, and race state for a single RotorHazard node. Use them over pilot camera feeds or in a multi-node matrix.

## URL

```bash
http://[RH-IP]:5000/stream/overlay/[theme]/node/[node]
```

Replace `[theme]` with `apex`, `dds`, or `lcdr`. Replace `[node]` with the one-based RotorHazard node number.

Examples:

```bash
http://192.168.1.100:5000/stream/overlay/apex/node/1
http://192.168.1.100:5000/stream/overlay/dds/node/2
http://192.168.1.100:5000/stream/overlay/lcdr/node/3
```

## Best uses

- Solo pilot camera scenes.
- Two-by-two race matrix scenes.
- Replay scenes where a single pilot needs context.

## OBS guidance

Set the browser source size to match the camera area or the full canvas, depending on how the theme is designed in your scene. Node overlays usually work well at 30 FPS.
