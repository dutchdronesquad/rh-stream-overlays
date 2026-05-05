import { render } from "preact";
import { readOverlayRuntime } from "../../core/overlayRuntime";

// Fase 4: implement TrackDraw overview overlay.
const { root } = readOverlayRuntime();
render(<></>, root);
