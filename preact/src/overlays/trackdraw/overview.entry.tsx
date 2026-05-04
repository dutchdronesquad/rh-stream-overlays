import { render } from "preact";

import { readOverlayRuntime } from "../../core/overlayRuntime";
import { connectRotorHazardSocket } from "../../core/rotorhazardSocket";
import { TrackDrawOverviewOverlay } from "./TrackDrawOverviewOverlay";

const runtime = readOverlayRuntime();

connectRotorHazardSocket({
  events: ["current_heat", "race_status", "current_laps", "leaderboard"]
});

render(<TrackDrawOverviewOverlay runtime={runtime} />, runtime.root);
