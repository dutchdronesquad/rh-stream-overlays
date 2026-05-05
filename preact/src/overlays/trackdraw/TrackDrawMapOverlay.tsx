import { useEffect, useRef } from "preact/hooks";
import { ConnectionWarning } from "../../components/ConnectionWarning";
import type { OverlayRuntimeConfig } from "../../core/overlayRuntime";
import { useRaceState } from "../../core/raceStore";
import { createTrackDrawRenderer } from "./trackCore/renderer";

export function TrackDrawMapOverlay({ runtime }: { runtime: OverlayRuntimeConfig }) {
  const { connection } = useRaceState();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    const renderer = createTrackDrawRenderer(svgRef.current, containerRef.current, runtime.theme);
    renderer.loadTrack();
    return () => renderer.destroy();
  }, []);

  return (
    <>
      <ConnectionWarning connection={connection} />
      <main class="trackdraw-map" data-theme={runtime.theme} ref={containerRef}>
        <section class="trackdraw-map__panel">
          <svg
            ref={svgRef}
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
