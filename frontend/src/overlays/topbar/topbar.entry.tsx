import { render } from "preact";
import { readOverlayRuntime } from "../../core/overlayRuntime";
import { connectRotorHazardSocket } from "../../core/rotorhazardSocket";
import { TopbarOverlay } from "./TopbarOverlay";

const runtime = readOverlayRuntime();
connectRotorHazardSocket({ events: ["leaderboard", "race_status"] });
render(<TopbarOverlay runtime={runtime} />, runtime.root);
