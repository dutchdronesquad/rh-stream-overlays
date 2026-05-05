import { useEffect } from "preact/hooks";
import { ConnectionWarning } from "../../components/ConnectionWarning";
import type { OverlayRuntimeConfig } from "../../core/overlayRuntime";
import { useRaceState } from "../../core/raceStore";
import { initTopbarTimer } from "./topbarTimer";

type Props = { runtime: OverlayRuntimeConfig };

export function TopbarOverlay({ runtime }: Props) {
  const { connection, leaderboard, raceStatus } = useRaceState();

  const heatTitle =
    leaderboard?.heatId === 0 ? "Practice" : (leaderboard?.displayName ?? "—");

  const isStaging = raceStatus?.label === "staging";

  // Apply race status as body class so CSS selectors like .race-running .timing-clock work
  useEffect(() => {
    const body = document.body;
    body.classList.remove("race-running", "race-stopped", "race-new");
    if (raceStatus?.label === "running" || raceStatus?.label === "staging") {
      body.classList.add("race-running");
    } else if (raceStatus?.label === "stopped") {
      body.classList.add("race-stopped");
    } else {
      body.classList.add("race-new");
    }
  }, [raceStatus?.label]);

  // Initialize the rotorhazard.timer socket events
  useEffect(() => initTopbarTimer(), []);

  return (
    <>
      <ConnectionWarning connection={connection} />
      <div class={`stream-topbar stream-topbar--${runtime.theme} apex-topbar`}>
        <div id="info-row" class="topbar-container rectangle item">
          <div
            id="timer"
            class={`timer-section rectangle item timing-clock${isStaging ? " staging" : ""}`}
          >
            <span class="time-display">--:--</span>
          </div>
          <div id="heat-info" class="heat-section">
            <div class="topbar-heat-content">
              <span id="js--heat-title">{heatTitle}</span>
              {runtime.eventName && (
                <>
                  <span class="separator">|</span>
                  <span class="event-name">{runtime.eventName}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
