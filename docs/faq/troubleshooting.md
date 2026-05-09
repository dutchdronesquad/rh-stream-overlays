---
title: Troubleshooting FAQ
description: Solutions to common problems with Stream Overlays.
---

# Troubleshooting

Solutions to common problems and error messages.

??? question "Overlay shows blank or 'waiting for race'"

    This is normal when:

    - No heat is loaded in RotorHazard
    - The race/practice session hasn't started
    - The node number doesn't match an active seat

    **Solution:** Load and stage a heat in RotorHazard.

??? question "Lap times don't update"

    Check the Socket.IO connection:

    1. Open browser developer console (F12)
    2. Look for WebSocket connection logs
    3. Verify RotorHazard version is 4.0.x or newer
    4. Check network latency if streaming remotely

??? question "Wrong pilot name or color appears"

    The node number in the URL must match the seat number in RotorHazard.

    Example: `.../node/2` displays data for seat 2.

    Verify the heat is loaded with pilots assigned to the correct seats.

??? question "Overlay loads slowly"

    Common causes:

    - Network latency (test URL in browser first)
    - Too many browser sources active
    - Low-end hardware on RotorHazard server
    - Browser source not cached properly

    Keep live race overlays loaded across scene switches so they stay connected during a race.

??? question "Overlay freezes during race"

    Possible issues:

    - RotorHazard server overloaded (check CPU usage)
    - Network connection dropped
    - OBS encoder overload (check OBS Stats)

    Try lowering browser source FPS to 30.

??? question "Can't access overlays over network"

    Check these:

    1. Firewall allows port 5000
    2. RotorHazard is bound to `0.0.0.0` (not `localhost`)
    3. Streaming computer can ping RotorHazard IP
    4. No VPN blocking local network access

??? question "Overlay elements misaligned"

    Ensure browser source dimensions match the overlay type:

    - Full-screen 1080p overlay → browser source 1920×1080
    - Full-screen 720p overlay → browser source 1280×720
    - Topbar on 1080p canvas → browser source 1920×100

    Don't scale or crop the browser source unless the scene layout intentionally requires it.

??? question "RotorHazard crashes after installing plugin"

    This is rare. Try:

    1. Check RotorHazard logs for errors
    2. Ensure plugin installed to correct directory
    3. Verify RotorHazard version compatibility (4.0.x+)
    4. Uninstall and reinstall the plugin

    Report persistent crashes as an [issue](https://github.com/dutchdronesquad/rh-stream-overlays/issues).

??? question "Overlay shows '404 Not Found'"

    The URL is incorrect. Check:

    - Theme name is correct (apex, dds, lcdr)
    - Overlay type is correct (node, topbar, heat)
    - Node number is valid (1-8)
    - Port is 5000

??? question "Browser console shows errors"

    Common errors and fixes:

    **WebSocket failed:** RotorHazard not running or unreachable

    **404 on assets:** Plugin not installed correctly, reinstall

    **CORS errors:** Accessing from wrong domain, use RotorHazard IP

??? question "Overlay works in browser but not OBS"

    Try:

    - Restart OBS
    - Clear browser source cache (right-click → Interact → Ctrl+F5)
    - Check OBS version is up to date
    - Verify browser source settings are correct
