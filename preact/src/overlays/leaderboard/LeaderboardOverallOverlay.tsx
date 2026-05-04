import type { OverlayRuntimeConfig } from "../../core/overlayRuntime";
import { useRaceState } from "../../core/raceStore";
import { selectOverallResults } from "../../core/resultDataSelectors";
import type { LeaderboardEntry } from "../../core/rotorhazardTypes";

type LeaderboardOverallOverlayProps = {
  runtime: OverlayRuntimeConfig;
};

function positionColor(position: number | null): string {
  if (position === 1) {
    return "gold";
  }

  if (position === 2) {
    return "silver";
  }

  if (position === 3) {
    return "#cd7f32";
  }

  return "darkorange";
}

function chunkEntries(entries: LeaderboardEntry[]): LeaderboardEntry[][] {
  const columns: LeaderboardEntry[][] = [[], [], [], []];
  entries.slice(0, 32).forEach((entry, index) => {
    columns[Math.floor(index / 8)].push(entry);
  });

  return columns;
}

export function LeaderboardOverallOverlay({
  runtime
}: LeaderboardOverallOverlayProps) {
  const raceState = useRaceState();
  const results = selectOverallResults(
    raceState.resultData,
    runtime.classId,
    raceState.currentHeat
  );

  if (!results || results.entries.length === 0) {
    return (
      <div class="container">
        <div id="header">
          <h1>No Data</h1>
        </div>
        <div class="leaderboard" id="leaderboard">
          <p>There is no saved race data available to view.</p>
        </div>
      </div>
    );
  }

  return (
    <div class="container">
      <div id="header">
        <h1>{results.title}</h1>
      </div>

      <div class="leaderboard" id="leaderboard">
        {chunkEntries(results.entries).map((column, columnIndex) => (
          <div class="column" key={columnIndex}>
            {column.map((entry, entryIndex) => (
              <div class="entry show" key={`${entry.position}-${entry.callsign}-${entryIndex}`}>
                <div
                  class="box position"
                  style={{ backgroundColor: positionColor(entry.position) }}
                >
                  <p>{entry.position ?? "-"}</p>
                </div>
                <p id="pilot_name">{entry.callsign ?? ""}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
