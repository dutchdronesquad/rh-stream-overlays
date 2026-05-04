import type { OverlayRuntimeConfig } from "../../core/overlayRuntime";

type TrackDrawMapOverlayProps = {
  runtime: OverlayRuntimeConfig;
};

export function TrackDrawMapOverlay({ runtime }: TrackDrawMapOverlayProps) {
  return (
    <main class="trackdraw-map" data-theme={runtime.theme}>
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
  );
}
