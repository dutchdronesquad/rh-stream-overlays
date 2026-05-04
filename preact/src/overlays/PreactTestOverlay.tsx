import { ConnectionWarning } from "../components/ConnectionWarning";
import type { OverlayRuntimeConfig } from "../core/overlayRuntime";
import { useRaceState } from "../core/raceStore";

type PreactTestOverlayProps = {
  runtime: OverlayRuntimeConfig;
};

export function PreactTestOverlay({ runtime }: PreactTestOverlayProps) {
  const raceState = useRaceState();
  const leaderboardCount = raceState.leaderboard?.entries.length ?? 0;

  return (
    <section class="preact-test" data-theme={runtime.theme}>
      <h1>Preact overlay runtime</h1>
      <dl>
        <div>
          <dt>Theme</dt>
          <dd>{runtime.theme}</dd>
        </div>
        <div>
          <dt>Node</dt>
          <dd>{runtime.node ?? "none"}</dd>
        </div>
        <div>
          <dt>Page</dt>
          <dd>{runtime.page ?? "test"}</dd>
        </div>
        <div>
          <dt>Connection</dt>
          <dd>{raceState.connection.isConnected ? "connected" : "pending"}</dd>
        </div>
        <div>
          <dt>Race</dt>
          <dd>{raceState.raceStatus?.label ?? "unknown"}</dd>
        </div>
        <div>
          <dt>Heat</dt>
          <dd>{raceState.currentHeat?.currentHeatId ?? "none"}</dd>
        </div>
        <div>
          <dt>Leaderboard</dt>
          <dd>{leaderboardCount}</dd>
        </div>
      </dl>
      <ConnectionWarning
        className="preact-test__warning"
        isConnected={raceState.connection.isConnected}
      />
    </section>
  );
}
