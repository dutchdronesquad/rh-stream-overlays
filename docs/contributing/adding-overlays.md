---
title: Adding overlays
description: How to add a new overlay to the Preact frontend.
---

# Adding overlays

New overlays follow a consistent pattern: an entry file that initialises the socket and renders a Preact component into an `#overlay-root` element, a component that reads from the shared race store, a Jinja2 template that loads the built bundle, and a route registered in `__init__.py`.

## 1. Create the entry file

Add `preact/src/overlays/<name>/<name>.entry.tsx`. It connects the socket with the events the overlay needs and mounts the component.

```tsx
import { render } from "preact";
import { readOverlayRuntime } from "../../core/overlayRuntime";
import { connectRotorHazardSocket } from "../../core/rotorhazardSocket";
import { MyOverlay } from "./MyOverlay";

const runtime = readOverlayRuntime();
connectRotorHazardSocket({ events: ["leaderboard", "race_status"] });
render(<MyOverlay runtime={runtime} />, runtime.root);
```

Available events: `language`, `current_heat`, `race_status`, `current_laps`, `leaderboard`, `result_data`, `heat_data`, `pilot_data`, `class_data`, `format_data`, `frequency_data`.

## 2. Create the component

Add `preact/src/overlays/<name>/MyOverlay.tsx`. Read state from `useRaceState()` — no direct socket calls needed.

```tsx
import type { OverlayRuntimeConfig } from "../../core/overlayRuntime";
import { useRaceState } from "../../core/raceStore";
import { ConnectionWarning } from "../../components/ConnectionWarning";

export function MyOverlay({ runtime }: { runtime: OverlayRuntimeConfig }) {
  const { connection, raceStatus, leaderboard } = useRaceState();

  return (
    <>
      <ConnectionWarning connection={connection} />
      <main class={`my-overlay theme-${runtime.theme}`}>
        {/* overlay content */}
      </main>
    </>
  );
}
```

**Available store fields** (`RaceStoreState`):

| Field | Type | Source event |
|-------|------|-------------|
| `connection` | `ConnectionState` | connect / disconnect |
| `raceStatus` | `NormalizedRaceStatus \| null` | `race_status` |
| `currentHeat` | `NormalizedCurrentHeat \| null` | `current_heat` |
| `currentLaps` | `NormalizedCurrentLaps \| null` | `current_laps` |
| `leaderboard` | `NormalizedLeaderboard \| null` | `leaderboard` |
| `resultData` | `RawRecord \| null` | `result_data` |
| `heatData` | `NormalizedCollection \| null` | `heat_data` |
| `pilotData` | `NormalizedCollection \| null` | `pilot_data` |
| `classData` | `NormalizedCollection \| null` | `class_data` |
| `formatData` | `NormalizedCollection \| null` | `format_data` |
| `frequencyData` | `NormalizedFrequencyData \| null` | `frequency_data` |

## 3. Register the entry point in Vite

Add the entry to `preact/vite.config.ts`:

```ts
"my-overlay": fromConfig("src/overlays/<name>/<name>.entry.tsx"),
```

This produces `custom_plugins/stream_overlays/static/dist/my-overlay.js` after `npm run build`.

## 4. Create the Jinja2 template

Add `custom_plugins/stream_overlays/pages/stream/<name>/<theme>.html`. Keep the template minimal — load CSS via `<link>` tags, mount `#overlay-root`, and load the bundle.

```html
{% extends 'layout-basic.html' %}
{% block title %}{{ __('Stream') }}: My Overlay{% endblock %}
{% block head %}
<link rel="stylesheet" href="{{ url_for('stream_overlays.static', filename='css/main/base.css') }}">
<link rel="stylesheet" href="{{ url_for('stream_overlays.static', filename='css/dds/my-overlay.css') }}">
{% endblock %}
{% block content %}
<div
  id="overlay-root"
  data-theme="{{ theme_name }}"
></div>
<script type="module" src="{{ url_for('stream_overlays.static', filename='dist/my-overlay.js') }}"></script>
{% endblock %}
```

If the overlay needs extra data from the server (node index, class ID, number of nodes), add `data-*` attributes on `#overlay-root` and read them via `readOverlayRuntime()`. The runtime already supports `node`, `classId`, `numNodes`, `eventName`, and `page`. For anything else, extend `OverlayRuntimeConfig` in `core/overlayRuntime.ts`.

## 5. Register the route

Add a route in the `initialize` function in `custom_plugins/stream_overlays/__init__.py`:

```python
@bp.route("/stream/overlay/<string:name>/my-overlay")
def render_my_overlay(name: str) -> str:
    """Render my overlay."""
    return _render_overlay(
        f"stream/<name>/<name>_{name}.html",
        serverInfo=None,
        getOption=rhapi.db.option,
        getConfig=rhapi.config.get_item,
        __=rhapi.__,
    )
```

Using `_render_overlay` instead of `templating.render_template` directly returns a 404 when the template for an unknown theme does not exist.

## 6. Build and test

```bash
cd preact
npm run build
```

Open the overlay URL in the browser, verify the `ConnectionWarning` disappears after the socket connects, and check that data updates correctly during a race.
