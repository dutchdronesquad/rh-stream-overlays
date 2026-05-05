import { render } from "preact";
import { readOverlayRuntime } from "../../core/overlayRuntime";
import { NodeOverlay } from "./NodeOverlay";

const runtime = readOverlayRuntime();
render(<NodeOverlay runtime={runtime} />, runtime.root);
