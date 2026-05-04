import { render } from "preact";

import { readOverlayRuntime } from "../../core/overlayRuntime";
import { TrackDrawMapOverlay } from "./TrackDrawMapOverlay";

const runtime = readOverlayRuntime();

render(<TrackDrawMapOverlay runtime={runtime} />, runtime.root);
