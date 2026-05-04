---
title: OBS Setup FAQ
description: Common questions about configuring overlays in OBS Studio.
---

# OBS Setup

Common questions about adding overlays to OBS and optimizing performance.

??? question "What browser source settings should I use?"

    | Setting | Recommended Value |
    |---------|------------------|
    | Width | 1920 for 1080p canvas |
    | Height | 100 for topbars, 1080 for full-screen overlays |
    | FPS | 30-60 |
    | Custom CSS | Keep the OBS default transparent background CSS |

    Enable these options:

    - Shutdown source when not visible
    - Refresh browser when scene becomes active

??? question "The overlay doesn't load in OBS"

    Check these issues:

    - Verify the URL uses your correct RotorHazard IP
    - Ensure port `:5000` is included
    - Test the URL in a web browser first
    - Check network connectivity to RotorHazard

??? question "Why is the overlay laggy?"

    Try these optimizations:

    - Lower browser source FPS to 30
    - Enable GPU acceleration (Settings → Advanced → Video Renderer)
    - Limit to 2-3 active browser sources per scene
    - Check CPU/GPU usage in OBS Stats

??? question "How do I resize overlays for different resolutions?"

    Match full-screen browser source dimensions to your OBS canvas:

    - 1080p: 1920×1080
    - 720p: 1280×720
    - 4K: 3840×2160

    Topbars are the exception. Use a wide, low source such as 1920×100.

??? question "Black screen or transparency issues?"

    **Use the default OBS Custom CSS.** It includes a transparent body background, which keeps overlay sources transparent.

    Also check: Settings → Advanced → Color Space is set to **sRGB**.

??? question "Can I use multiple overlays in one scene?"

    Yes, but limit to 2-3 active browser sources to avoid performance issues. Use separate scenes for different overlay combinations.

??? question "Overlay shows old data after scene switch?"

    Enable **Refresh browser when scene becomes active** in browser source properties.

    Manual fix: right-click source → **Refresh cache of current page**.

??? question "Can I project overlays to an external display?"

    Yes, two methods:

    **Browser fullscreen:**

    1. Open overlay URL in Chrome
    2. Press F11 for fullscreen
    3. Drag to target display

    **OBS Projector:** right-click scene → **Fullscreen Projector** → choose display.

??? question "How do I cache overlays for faster loading?"

    The recommended browser source settings handle caching:

    - **Shutdown source when not visible** keeps overlay in memory.
    - **Refresh browser when scene becomes active** loads fresh data.

??? question "What's the difference between 30 and 60 FPS?"

    - **60 FPS:** smoother animations, higher CPU usage. Good for topbars with timers.
    - **30 FPS:** adequate for most overlays, lower CPU usage. Good for node views.
