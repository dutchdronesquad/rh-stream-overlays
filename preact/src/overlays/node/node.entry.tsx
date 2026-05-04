import { render } from "preact";

import { readOverlayRuntime } from "../../core/overlayRuntime";
import { connectRotorHazardSocket } from "../../core/rotorhazardSocket";
import { NodeOverlay } from "./NodeOverlay";

const runtime = readOverlayRuntime();

connectRotorHazardSocket({
  events: ["language", "race_status", "leaderboard", "current_laps", "current_heat"]
});

render(<NodeOverlay runtime={runtime} />, runtime.root);
