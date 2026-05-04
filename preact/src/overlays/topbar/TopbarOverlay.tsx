import type { OverlayRuntimeConfig } from "../../core/overlayRuntime";
import { useRaceState } from "../../core/raceStore";

type TopbarOverlayProps = {
  runtime: OverlayRuntimeConfig;
};

type TopbarConfig = {
  eventName?: string;
};

type TopbarGlobals = typeof globalThis & {
  topbarOverlayConfig?: TopbarConfig;
};

function config(): TopbarConfig {
  return (globalThis as TopbarGlobals).topbarOverlayConfig ?? {};
}

export function TopbarOverlay({ runtime }: TopbarOverlayProps) {
  const raceState = useRaceState();
  const theme = runtime.theme;
  const heatName =
    raceState.leaderboard?.heatId === 0
      ? "Practice"
      : raceState.leaderboard?.displayName ?? "";
  const eventName = config().eventName ?? "";

  if (theme === "apex") {
    return (
      <div class="apex-topbar">
        <div id="info-row" class="topbar-container">
          <div id="timer" class="timer-section timing-clock">
            <div class="time-display">--:--</div>
          </div>
          <div id="heat-info" class="heat-section">
            <span id="js--heat-title">{heatName}</span>
            <span class="separator">|</span>
            <span class="event-name">{eventName}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="info-row" class="rectangle item">
      <div id="heat-info">
        <div style={{ marginLeft: "250px" }}>
          <span id="js--heat-title">{heatName}</span>
          <span style={{ margin: "0 10px" }}>|</span>
          <span>{eventName}</span>
        </div>
      </div>
      <div id="timer" class="rectangle item timing-clock">
        <span class="time-display">--:--</span>
      </div>
    </div>
  );
}
