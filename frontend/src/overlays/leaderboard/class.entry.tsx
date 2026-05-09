import { render } from "preact";
import { readOverlayRuntime } from "../../core/overlayRuntime";
import { connectRotorHazardSocket } from "../../core/rotorhazardSocket";
import { LeaderboardOverlay } from "./LeaderboardOverlay";

const runtime = readOverlayRuntime();
connectRotorHazardSocket({ events: ["language", "result_data", "current_heat"] });
render(<LeaderboardOverlay runtime={runtime} view="class" />, runtime.root);
