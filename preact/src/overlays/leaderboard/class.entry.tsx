import { render } from "preact";

import { readOverlayRuntime } from "../../core/overlayRuntime";
import { connectRotorHazardSocket } from "../../core/rotorhazardSocket";
import { LeaderboardClassOverlay } from "./LeaderboardClassOverlay";

const runtime = readOverlayRuntime();

connectRotorHazardSocket({
  events: ["language", "current_heat", "result_data"],
  requestLoadData: runtime.classId === 0
});

render(<LeaderboardClassOverlay runtime={runtime} />, runtime.root);
