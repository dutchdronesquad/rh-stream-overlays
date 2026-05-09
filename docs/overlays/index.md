---
title: Overlays
description: Overview of all available overlays for the Stream Overlays plugin for RotorHazard.
---

# Overlay overview

Stream Overlays is built from three concepts:

- **Theme packages** control the visual style.
- **Overlay types** control what data a browser source shows.
- **Integrations** add external data sources, such as TrackDraw.

Start with a theme package when you want a cohesive look. Use the overlay type pages when you need exact URL patterns or OBS guidance.

!!! question "Want a custom theme?"
    Start a topic in [Discussions](https://github.com/dutchdronesquad/rh-stream-overlays/discussions) with your branding and we can create a custom preset.

## Theme packages

<div class="overlay-theme-grid">
  <a href="./apex" class="theme-card">
    <div class="theme-card__preview">
      <img src="../assets/img/overlays/apex/apex-node.gif" alt="Apex overlay preview">
    </div>
    <div class="theme-card__content">
      <h3>Apex</h3>
      <p>Glassy esports overlay with floating rank badge, lap popups, and metallic topbar.</p>
    </div>
  </a>

  <a href="./dds" class="theme-card">
    <div class="theme-card__preview">
      <img src="../assets/img/overlays/dds/dds-node.gif" alt="DDS overlay preview">
    </div>
    <div class="theme-card__content">
      <h3>Dutch Drone Squad</h3>
      <p>Bold orange triangles, scrolling lap marquee, and matching DDS topbar.</p>
    </div>
  </a>

  <a href="./lcdr" class="theme-card">
    <div class="theme-card__preview">
      <img src="../assets/img/overlays/lcdr/lcdr-node.gif" alt="LCDR overlay preview">
    </div>
    <div class="theme-card__content">
      <h3>LCDR</h3>
      <p>Minimalist Liga Colombiana Drone Racing lower-third with lap marquee.</p>
    </div>
  </a>
</div>

## Overlay types

| Type | Available themes | Best for |
|------|------------------|----------|
| [Node overlays](types/nodes.md) | Apex, DDS, LCDR | Pilot camera scenes and node grids |
| [Topbars](types/topbars.md) | Apex, DDS, LCDR | Race title, event branding, and timer context |
| [Upcoming heat](types/upcoming-heat.md) | Apex, DDS, LCDR | Pre-race lineups and intermission scenes |
| [Leaderboards](types/leaderboards.md) | DDS | Class and overall rankings |

## Integrations

| Integration | Overlays | Use it when |
|-------------|----------|-------------|
| [TrackDraw](../integrations/trackdraw/index.md) | Live Race Map, Overview | You want live track-position visuals based on TrackDraw geometry |

TrackDraw overlays are documented under Integrations because they require project setup before they can be used in OBS.
