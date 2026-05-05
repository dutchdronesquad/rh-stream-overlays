import { render } from "preact";
import { readOverlayRuntime } from "../../core/overlayRuntime";
import { connectRotorHazardSocket } from "../../core/rotorhazardSocket";
import { HeatOverlay } from "./HeatOverlay";

const runtime = readOverlayRuntime();
connectRotorHazardSocket({
  events: [
    "language",
    "current_heat",
    "heat_data",
    "pilot_data",
    "class_data",
    "format_data",
    "frequency_data",
  ],
});
render(<HeatOverlay runtime={runtime} />, runtime.root);
