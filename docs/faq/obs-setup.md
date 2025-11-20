---
title: OBS Setup FAQ
description: Common questions about configuring overlays in OBS Studio.
---

# OBS Setup

Common questions about adding overlays to OBS and optimizing performance.

## What browser source settings should I use?

| Setting | Recommended Value |
|---------|------------------|
| Width | 1920 (match canvas) |
| Height | 1080 (match canvas) |
| FPS | 30-60 |
| Custom CSS | Leave empty |

Enable these options:

- ✓ Shutdown source when not visible
- ✓ Refresh browser when scene becomes active

## The overlay doesn't load in OBS

Check these issues:

- Verify the URL uses your correct RotorHazard IP
- Ensure port `:5000` is included
- Test the URL in a web browser first
- Check network connectivity to RotorHazard

## Why is the overlay laggy?

Try these optimizations:

- Lower browser source FPS to 30
- Enable GPU acceleration (Settings → Advanced → Video Renderer)
- Limit to 2-3 active browser sources per scene
- Check CPU/GPU usage in OBS Stats

## How do I resize overlays for different resolutions?

Match your browser source dimensions to your OBS canvas:

- 1080p: 1920×1080
- 720p: 1280×720
- 4K: 3840×2160

Overlays scale proportionally.

## Black screen or transparency issues?

**Ensure Custom CSS is empty.** Overlays handle transparency internally.

Also check: Settings → Advanced → Color Space is set to **sRGB**.

## Can I use multiple overlays in one scene?

Yes, but limit to 2-3 active browser sources to avoid performance issues. Use separate scenes for different overlay combinations.

## Overlay shows old data after scene switch?

Enable **Refresh browser when scene becomes active** in browser source properties.

Manual fix: Right-click source → **Refresh cache of current page**.

## Can I project overlays to an external display?

Yes, two methods:

**Browser fullscreen:**

1. Open overlay URL in Chrome
2. Press F11 for fullscreen
3. Drag to target display

**OBS Projector:**
Right-click scene → **Fullscreen Projector** → Choose display

## How do I cache overlays for faster loading?

The recommended browser source settings handle caching:

- **Shutdown source when not visible** — Keeps overlay in memory
- **Refresh browser when scene becomes active** — Loads fresh data

## What's the difference between 30 and 60 FPS?

- **60 FPS:** Smoother animations, higher CPU usage (good for topbars with timers)
- **30 FPS:** Adequate for most overlays, lower CPU usage (good for node views)
