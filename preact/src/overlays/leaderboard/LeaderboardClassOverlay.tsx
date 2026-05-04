import { useEffect, useMemo, useState } from "preact/hooks";

import type { OverlayRuntimeConfig } from "../../core/overlayRuntime";
import { useRaceState } from "../../core/raceStore";
import {
  type ClassLeaderboardDisplayType,
  selectClassResults
} from "../../core/resultDataSelectors";
import type { LeaderboardEntry, RawRecord } from "../../core/rotorhazardTypes";

type LeaderboardClassOverlayProps = {
  runtime: OverlayRuntimeConfig;
};

const ITEMS_PER_PAGE = 8;
const PAGE_INTERVAL_MS = 10000;

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

function asRecord(value: unknown): RawRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : {};
}

function asText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function chunkEntries(entries: LeaderboardEntry[]): LeaderboardEntry[][] {
  const chunks: LeaderboardEntry[][] = [];
  for (let index = 0; index < entries.length; index += ITEMS_PER_PAGE) {
    chunks.push(entries.slice(index, index + ITEMS_PER_PAGE));
  }

  return chunks;
}

function headerLabels(displayType: ClassLeaderboardDisplayType): string[] {
  if (displayType === "by_fastest_lap") {
    return ["FASTEST LAP", "SOURCE"];
  }

  if (displayType === "by_consecutives") {
    return ["CONSECUTIVE", "SOURCE"];
  }

  return ["LAPS", "AVG", "TOTAL"];
}

function rightGridColumns(displayType: ClassLeaderboardDisplayType): string {
  return displayType === "by_race_time" ? "repeat(3, 1fr)" : "repeat(2, 1fr)";
}

function sourceText(source: unknown): string {
  const sourceInfo = asRecord(source);
  const displayName = asText(sourceInfo.displayname);
  const round = asText(sourceInfo.round);

  return [displayName, round ? `Round ${round}` : ""].filter(Boolean).join(" / ");
}

function metricValues(
  entry: LeaderboardEntry,
  displayType: ClassLeaderboardDisplayType
): string[] {
  if (displayType === "by_fastest_lap") {
    return [asText(entry.raw.fastest_lap), sourceText(entry.raw.fastest_lap_source)];
  }

  if (displayType === "by_consecutives") {
    return [
      `${asText(entry.raw.consecutives_base)}/${asText(entry.raw.consecutives)}`,
      sourceText(entry.raw.consecutives_source)
    ];
  }

  return [
    asText(entry.raw.laps),
    asText(entry.raw.average_lap),
    asText(entry.raw.total_time)
  ];
}

export function LeaderboardClassOverlay({ runtime }: LeaderboardClassOverlayProps) {
  const raceState = useRaceState();
  const results = selectClassResults(
    raceState.resultData,
    runtime.classId,
    raceState.currentHeat
  );
  const pages = useMemo(
    () => chunkEntries(results?.entries ?? []),
    [results?.entries]
  );
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex(0);
  }, [results?.entries]);

  useEffect(() => {
    if (pages.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setPageIndex((currentPage) => (currentPage + 1) % pages.length);
    }, PAGE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [pages.length]);

  if (!results || results.entries.length === 0) {
    return (
      <div class="container">
        <div id="header">
          <div class="left">
            <h1 id="title">No Data</h1>
          </div>
          <div class="right" />
        </div>
        <div class="leaderboard" id="leaderboard">
          <p>There is no saved race data available to view.</p>
        </div>
      </div>
    );
  }

  const activePage = pages[pageIndex] ?? [];
  const labels = headerLabels(results.displayType);
  const startRange = pageIndex * ITEMS_PER_PAGE + 1;
  const endRange = Math.min((pageIndex + 1) * ITEMS_PER_PAGE, results.entries.length);

  return (
    <div class="container">
      <div id="header">
        <div class="left">
          <h1 id="title">{results.title}</h1>
        </div>
        <div
          class="right"
          style={{ gridTemplateColumns: rightGridColumns(results.displayType) }}
        >
          {labels.map((label) => (
            <p class="label" key={label}>
              {label}
            </p>
          ))}
        </div>
      </div>

      <div class="leaderboard" id="leaderboard">
        {activePage.map((entry, index) => (
          <div class="entry show" key={`${entry.position}-${entry.callsign}-${index}`}>
            <div
              class="box position"
              style={{ backgroundColor: positionColor(entry.position) }}
            >
              <p>{entry.position ?? "-"}</p>
            </div>
            <div class="info">
              <div class="left">
                <p class="pilot_name">{entry.callsign ?? ""}</p>
              </div>
              <div
                class="right"
                style={{ gridTemplateColumns: rightGridColumns(results.displayType) }}
              >
                {metricValues(entry, results.displayType).map((value, metricIndex) => (
                  <p key={metricIndex}>{value}</p>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {pages.length > 1 ? (
        <div id="currentIndexIndicator">
          Showing {startRange}-{endRange} of {results.entries.length}
        </div>
      ) : null}
    </div>
  );
}
