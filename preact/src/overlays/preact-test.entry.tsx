import { render } from "preact";

import { readOverlayRuntime } from "../core/overlayRuntime";
import { connectRotorHazardSocket } from "../core/rotorhazardSocket";
import { PreactTestOverlay } from "./PreactTestOverlay";
import "./preact-test.css";

const runtime = readOverlayRuntime();

connectRotorHazardSocket({
  events: ["language", "current_heat", "race_status", "current_laps", "leaderboard"]
});

render(<PreactTestOverlay runtime={runtime} />, runtime.root);
