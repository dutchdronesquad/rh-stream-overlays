import { ConnectionWarning } from "../../components/ConnectionWarning";
import type { OverlayRuntimeConfig } from "../../core/overlayRuntime";
import { useRaceState } from "../../core/raceStore";

type Props = { runtime: OverlayRuntimeConfig };

// SVG content is managed imperatively by trackdraw_map.js via DOM IDs — this component only owns the shell and connection state.
export function TrackDrawMapOverlay({ runtime }: Props) {
  const { connection } = useRaceState();
  const theme = runtime.theme;

  return (
    <>
      <ConnectionWarning connection={connection} />
      <main class="trackdraw-map" data-theme={theme}>
        <section class="trackdraw-map__panel">
          <svg
            id="trackdraw-map-svg"
            class="trackdraw-map__svg"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="TrackDraw live race map"
          />
          <div id="trackdraw-map-message" class="trackdraw-map__message is-visible">
            Loading TrackDraw map...
          </div>
        </section>
      </main>
    </>
  );
}
