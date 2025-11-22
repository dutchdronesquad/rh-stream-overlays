---
title: Installation FAQ
description: Common questions about installing Stream Overlays.
---

# Installation

Common questions about installing and updating Stream Overlays.

## How do I install Stream Overlays?

The easiest method is through RotorHazard's Community Plugins:

1. Go to **Settings** → **Plugins**
2. Click **Browse Community Plugins**
3. Search for "Stream Overlays"
4. Click **Install**
5. Restart RotorHazard

See the [Installation Guide](../getting-started/installation.md) for alternative methods.

## Where do I find overlay URLs?

**Option 1:** Navigate to the **Streams** page in RotorHazard (4.2.x+) and click any overlay link.

**Option 2:** Construct URLs manually:
```text
http://[RH-IP]:5000/stream/overlay/[theme]/[type]/[node]
```

See the [Overlay Catalog](../overlays/index.md) for all URLs.

## How do I update the plugin?

Use the same method you used to install. The Community Plugins interface shows an **Update** button when a new version is available.

## Can I install on older RotorHazard versions?

Stream Overlays requires RotorHazard 4.0.x or newer. Some features like Stream Displays need 4.2.x+.

## The install script fails

Check these common issues:

**No internet connection:**
```bash
curl -I https://api.github.com
```

**Permission errors:**
```bash
sudo bash -c "$(curl -fsSL https://short.dutchdronesquad.nl/install-overlays-plugin)"
```

**Wrong RotorHazard path:**
The script looks for `/home/pi/RotorHazard/` or `~/RotorHazard/`

## How do I verify installation worked?

1. Go to **Settings** → **Plugins** and check if Stream Overlays is listed
2. Navigate to **Streams** page and look for overlay panels
3. Click an overlay link to test it in your browser

## Can I install multiple versions?

No. Only one version can be active at a time. Updating replaces the existing installation.

## How do I uninstall?

**Via Interface:**

1. Go to **Settings** → **Plugins**
2. Find Stream Overlays
3. Click **Uninstall**
4. Restart RotorHazard

**Manual removal:**
```bash
rm -rf ~/RotorHazard/src/server/plugins/stream_overlays
```
