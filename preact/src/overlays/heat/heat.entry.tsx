import { render } from "preact";
import { readOverlayRuntime } from "../../core/overlayRuntime";
import { HeatOverlay } from "./HeatOverlay";

const runtime = readOverlayRuntime();
render(<HeatOverlay runtime={runtime} />, runtime.root);
