import { render } from "preact";

import { readOverlayRuntime } from "../../core/overlayRuntime";
import { connectRotorHazardSocket } from "../../core/rotorhazardSocket";
import { LeaderboardOverallOverlay } from "./LeaderboardOverallOverlay";

const runtime = readOverlayRuntime();

connectRotorHazardSocket({
  events: ["language", "current_heat", "result_data"],
  requestLoadData: runtime.classId === 0
});

render(<LeaderboardOverallOverlay runtime={runtime} />, runtime.root);
