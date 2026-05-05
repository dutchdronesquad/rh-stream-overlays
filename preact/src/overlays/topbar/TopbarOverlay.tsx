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
      <div id="info-row" class="rectangle item">
        <div id="heat-info">
          <div style={{ marginLeft: "250px" }}>
            <span id="js--heat-title">{heatTitle}</span>
            {runtime.eventName && (
              <>
                <span style={{ margin: "0 10px" }}>|</span>
                <span>{runtime.eventName}</span>
              </>
            )}
          </div>
        </div>
        <div id="timer" class={`rectangle item timing-clock${isStaging ? " staging" : ""}`}>
          <span class="time-display">--:--</span>
        </div>
      </div>
    </>
  );
}
