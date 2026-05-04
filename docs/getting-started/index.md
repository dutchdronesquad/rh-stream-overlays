---
title: Quick Start
description: Get your stream overlays running in 5 minutes.
---

# Quick Start

Get Stream Overlays up and running in just a few minutes.

## 1. Install the Plugin

=== "Community Plugins (Recommended)"

    1. Open RotorHazard → **Settings** → **Plugins**
    2. Click **Browse Community Plugins**
    3. Search for **Stream Overlays** → **Install**
    4. Restart RotorHazard

=== "Install Script"

    ```bash
    bash -c "$(curl -fsSL https://short.dutchdronesquad.nl/install-overlays-plugin)"
    ```

    Choose **stable**, then restart RotorHazard.

📖 **[Full installation guide →](installation.md)**

---

## 2. Get Overlay URL

**Option A: Stream Displays Page** (RotorHazard 4.2.x+)

1. Go to **Streams** page in RotorHazard
2. Click any overlay link
3. Copy the URL from your browser

**Option B: Manual URL**

```
http://[RH-IP]:5000/stream/overlay/[theme]/[type]/[node]
```

**Examples:**

- `http://192.168.1.100:5000/stream/overlay/apex/node/1`
- `http://192.168.1.100:5000/stream/overlay/dds/topbar`

📖 **[View overlay types and URLs →](../overlays/index.md)**

---

## 3. Add to OBS

1. In OBS, click **+** in Sources → **Browser**
2. Enter your overlay URL
3. Set **Width** and **Height** to match your canvas (e.g., 1920×1080)
4. Enable these options:
    - [x] **Shutdown source when not visible**
    - [x] **Refresh browser when scene becomes active**
5. Click **OK**

📖 **[Detailed OBS setup guide →](obs-setup.md)**

---

## 4. Test Your Overlay

1. Load a heat in RotorHazard with pilots assigned
2. Stage or start a race
3. Verify overlay updates in OBS

**That's it!** Your overlays are now synced with RotorHazard.

---

## Next Steps

<div class="next-steps-grid">
  <div class="next-step-card">
    <span class="next-step-icon">🎨</span>
    <strong>Explore Overlays</strong>
    <p>Browse theme packages, overlay types, and integration-based overlays in the <a href="/overlays">Overlay Overview</a>.</p>
  </div>
  <div class="next-step-card">
    <span class="next-step-icon">⚙️</span>
    <strong>Build Scenes</strong>
    <p>Use production recipes in <a href="/production/obs-scene-layouts">OBS Scene Layouts</a>.</p>
  </div>
  <div class="next-step-card">
    <span class="next-step-icon">🗺️</span>
    <strong>Add TrackDraw</strong>
    <p>Configure map and overview overlays in the <a href="/integrations/trackdraw">TrackDraw Integration</a>.</p>
  </div>
  <div class="next-step-card">
    <span class="next-step-icon">❓</span>
    <strong>Troubleshooting</strong>
    <p>Find solutions to common issues in the <a href="/faq">FAQ</a>.</p>
  </div>
</div>

---

## Need Help?

- **Questions:** [GitHub Discussions](https://github.com/dutchdronesquad/rh-stream-overlays/discussions)
- **Bugs:** [Report an issue](https://github.com/dutchdronesquad/rh-stream-overlays/issues/new/choose)
- **Community:** [RotorHazard Discord](https://discord.gg/ANKd2pzBKH)
