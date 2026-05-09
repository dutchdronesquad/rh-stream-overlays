---
title: Topbars
description: Topbar overlay URLs and usage guidance.
---

# Topbars

Topbars show high-level race context such as heat name, event title, timer state, and broadcast branding. Use one topbar per main race scene.

## URL

```bash
http://[RH-IP]:5000/stream/overlay/[theme]/topbar
```

Replace `[theme]` with `apex`, `dds`, or `lcdr`.

Examples:

```bash
http://192.168.1.100:5000/stream/overlay/apex/topbar
http://192.168.1.100:5000/stream/overlay/dds/topbar
http://192.168.1.100:5000/stream/overlay/lcdr/topbar
```

## Best uses

- Race matrix scenes.
- Solo pilot camera scenes.
- Results scenes where the heat title should remain visible.

## OBS guidance

Use a wide, low browser source, usually `1920 x 100`, and position it at the top of the scene. Use 60 FPS when the topbar includes timer or ticker motion.
