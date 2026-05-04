import { render } from "preact";

import { readOverlayRuntime } from "../../core/overlayRuntime";
import { bindRotorHazardTimer } from "../../core/rotorhazardTimer";
import { connectRotorHazardSocket } from "../../core/rotorhazardSocket";
import { TopbarOverlay } from "./TopbarOverlay";

const runtime = readOverlayRuntime();

connectRotorHazardSocket({
  events: ["leaderboard", "race_status", "result_data"]
});

render(<TopbarOverlay runtime={runtime} />, runtime.root);
bindRotorHazardTimer();
