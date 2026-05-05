import { render } from "preact";
import { readOverlayRuntime } from "../../core/overlayRuntime";
import { connectRotorHazardSocket } from "../../core/rotorhazardSocket";
import { TrackDrawMapOverlay } from "./TrackDrawMapOverlay";

const runtime = readOverlayRuntime();
connectRotorHazardSocket({
  events: ["current_heat", "race_status", "current_laps", "leaderboard"],
});
render(<TrackDrawMapOverlay runtime={runtime} />, runtime.root);
