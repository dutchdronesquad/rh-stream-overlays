import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { OverlayRuntimeConfig } from "../../core/overlayRuntime";
import { useRaceState } from "../../core/raceStore";
import type { LeaderboardEntry, RawRecord } from "../../core/rotorhazardTypes";

type NodeOverlayProps = {
  runtime: OverlayRuntimeConfig;
};

type LapRecord = RawRecord & {
  lap_index?: number;
  lap_number?: number;
  lap_raw?: number;
  lap_time?: string;
  lap_time_formatted?: string;
  splits?: RawRecord[];
};

type NodeLapData = RawRecord & {
  fastest_lap_index?: number;
  laps?: LapRecord[];
};

type RotorHazardGlobals = typeof globalThis & {
  rotorhazard?: {
    min_lap?: number;
    show_messages?: boolean;
  };
};

const DEFAULT_LAP_LIMIT = 10;

function asRecord(value: unknown): RawRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : {};
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function colorValueToHex(value: unknown): string | null {
  const color = asNumber(value);
  if (color === null) {
    return null;
  }

  return `#${color.toString(16).padStart(6, "0").slice(-6)}`;
}

function contrastColor(hexColor: string): string {
  const normalized = hexColor.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;

  return luminance > 140 ? "#000000" : "#ffffff";
}

function ordinal(value: number | null): string {
  if (value === null) {
    return "";
  }

  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return "th";
  }

  if (value % 10 === 1) {
    return "st";
  }

  if (value % 10 === 2) {
    return "nd";
  }

  if (value % 10 === 3) {
    return "rd";
  }

  return "th";
}

function formatRankStat(entry: LeaderboardEntry | null, primary: string | null): string {
  if (!entry) {
    return "";
  }

  if (primary === "by_fastest_lap") {
    return asText(entry.raw.fastest_lap);
  }

  if (primary === "by_consecutives") {
    return asText(entry.raw.consecutives);
  }

  return entry.totalTime ?? "";
}

function formatLapTime(lap: LapRecord): string {
  let lapTime = asText(lap.lap_time_formatted || lap.lap_time);
  const splits = Array.isArray(lap.splits) ? lap.splits : [];
  const splitParts = splits
    .map((split) => {
      const splitTime = asText(split.split_time_formatted || split.split_time);
      return split.split_speed ? `${splitTime}/${asText(split.split_speed)}` : splitTime;
    })
    .filter(Boolean);

  if (splitParts.length) {
    lapTime += ` (${splitParts.join(", ")})`;
  }

  return lapTime;
}

function lapClassName(
  lap: LapRecord,
  nodeData: NodeLapData | null,
  index: number,
  theme: string
): string {
  const classes: string[] = [];
  if (lap.lap_number === 0) {
    classes.push("from_start");
  }

  if (lap.lap_index !== undefined && lap.lap_index === nodeData?.fastest_lap_index) {
    classes.push(theme === "apex" ? "fastest-lap" : "fastest_lap");
  }

  const minLap = (globalThis as RotorHazardGlobals).rotorhazard?.min_lap;
  if (index > 0 && typeof lap.lap_raw === "number" && minLap && lap.lap_raw < minLap * 1000) {
    classes.push("min-lap-warning");
  }

  return classes.join(" ");
}

function applyHeatColor(heatNodes: unknown, nodeIndex: number | null): void {
  if (nodeIndex === null) {
    return;
  }

  const node = asRecord(asRecord(heatNodes)[String(nodeIndex)]);
  const color = colorValueToHex(node.activeColor);
  const root = document.documentElement;

  if (color) {
    const contrast = contrastColor(color);
    root.style.setProperty("--pilot_color", color);
    root.style.setProperty("--contrast_pilot_color", contrast);
    root.style.setProperty("--position_foreground_color", color);
    root.style.setProperty("--position_background_color", contrast);
    root.style.setProperty("--fast_lap_color", color);
    root.style.setProperty("--contrast_fast_lap_color", contrast);
    return;
  }

  root.style.setProperty("--pilot_color", "hsl(var(--hue_0), var(--sat_0), var(--lum_0_low))");
  root.style.setProperty("--contrast_pilot_color", "var(--contrast_0_low)");
  root.style.setProperty("--position_background_color", "hsl(var(--hue_1), var(--sat_1), var(--lum_1_high))");
  root.style.setProperty("--position_foreground_color", "var(--contrast_1_high)");
  root.style.setProperty("--fast_lap_color", "hsl(var(--hue_1), var(--sat_1), var(--lum_1_high))");
  root.style.setProperty("--contrast_fast_lap_color", "var(--contrast_1_high)");
}

function usePopup(lapCount: number): boolean {
  const previousLapCount = useRef(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (lapCount > 0 && lapCount > previousLapCount.current) {
      setIsVisible(true);
      const timeoutId = window.setTimeout(() => {
        setIsVisible(false);
      }, 3000);
      previousLapCount.current = lapCount;
      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    previousLapCount.current = lapCount;
    return undefined;
  }, [lapCount]);

  return isVisible;
}

function LapList({
  laps,
  nodeData,
  theme
}: {
  laps: LapRecord[];
  nodeData: NodeLapData | null;
  theme: string;
}) {
  return (
    <ul id="pilot_lap-times">
      {[...laps].reverse().map((lap, index) => {
        const label = lap.lap_number === 0 ? "HS" : asText(lap.lap_number);
        const className = lapClassName(lap, nodeData, index, theme);

        if (theme === "apex") {
          return (
            <li class={className} key={`${lap.lap_index}-${index}`}>
              <div class="lap-num-box">{label}</div>
              <div class="lap-time-box">{formatLapTime(lap)}</div>
            </li>
          );
        }

        return (
          <li class={className} key={`${lap.lap_index}-${index}`}>
            {lap.lap_number === 0 ? `HS: ${formatLapTime(lap)}` : `${label}| ${formatLapTime(lap)}`}
          </li>
        );
      })}
    </ul>
  );
}

function ApexNodeOverlay({
  entry,
  isPopupVisible,
  lapCount,
  laps,
  lastLap,
  nodeData,
  primary
}: {
  entry: LeaderboardEntry | null;
  isPopupVisible: boolean;
  lapCount: number;
  laps: LapRecord[];
  lastLap: string;
  nodeData: NodeLapData | null;
  primary: string | null;
}) {
  return (
    <main class="page-streamnode apex-theme">
      <div id="popup-container" class={isPopupVisible ? "show" : ""}>
        <div class="popup-content">
          <div class="popup-lap">
            LAP <span class="lap_number">{lapCount}</span>
          </div>
          <div class="popup-time" id="last_laptime">
            {lastLap}
          </div>
        </div>
      </div>

      <div class="position-badge">
        <span class="position-number" id="pilot_position">
          {entry?.position ?? ""}
        </span>
        <sup class="position-ordinal" id="pos_ordinal">
          {ordinal(entry?.position ?? null)}
        </sup>
      </div>

      <div class="apex-overlay-container">
        <div class="info-card">
          <div class="pilot-header">
            <div class="pilot-callsign" id="pilot_callsign">
              {entry?.callsign ?? ""}
            </div>
            <div class="pilot-laps">
              <span class="lap-label">LAP</span>
              <span class="lap_number">{lapCount}</span>
            </div>
          </div>
          <div class="time-display">
            <div class="total-time" id="total_time">
              {formatRankStat(entry, primary) || "0:00.000"}
            </div>
          </div>
          <div class="laps-section">
            <LapList laps={laps} nodeData={nodeData} theme="apex" />
          </div>
        </div>
        <div class="accent-bar" />
      </div>
    </main>
  );
}

function DdsNodeOverlay({
  entry,
  isPopupVisible,
  lapCount,
  laps,
  lastLap,
  nodeData,
  primary
}: {
  entry: LeaderboardEntry | null;
  isPopupVisible: boolean;
  lapCount: number;
  laps: LapRecord[];
  lastLap: string;
  nodeData: NodeLapData | null;
  primary: string | null;
}) {
  return (
    <main class="page-streamnode">
      <div id="popup-container" style={{ top: isPopupVisible ? "45%" : "-50%" }}>
        <div class="box laps">
          <p>
            LAP <span class="lap_number">{lapCount}</span>
          </p>
        </div>
        <div class="box time">
          <p id="last_laptime">{lastLap}</p>
        </div>
      </div>

      <div id="overlay-top">
        <div class="position-container">
          <span id="pilot_position">{entry?.position ?? ""}</span>
          <sup id="pos_ordinal">{ordinal(entry?.position ?? null)}</sup>
        </div>
      </div>

      <div class="overlay-bottom">
        <div class="row first-bar">
          <div id="pilot_callsign">{entry?.callsign ?? ""}</div>
          <div class="align-right" id="laps_label">
            LAPS: <span class="lap_number">{lapCount}</span>
          </div>
        </div>
        <div class="row second-bar">
          <div class="laps-container">
            <LapList laps={laps} nodeData={nodeData} theme="dds" />
          </div>
          <div class="align-right" id="total_time">
            {formatRankStat(entry, primary) || "0:00.000"}
          </div>
        </div>
        <div class="triangle bottom" />
      </div>
    </main>
  );
}

function LcdrNodeOverlay({
  entry,
  isPopupVisible,
  lapCount,
  laps,
  lastLap,
  nodeData,
  primary
}: {
  entry: LeaderboardEntry | null;
  isPopupVisible: boolean;
  lapCount: number;
  laps: LapRecord[];
  lastLap: string;
  nodeData: NodeLapData | null;
  primary: string | null;
}) {
  return (
    <main class="page-streamnode">
      <div id="popup-container" style={{ right: isPopupVisible ? "400px" : "0px" }}>
        <div class="box laps">
          <p>
            LAP <span class="lap_number">{lapCount}</span>
          </p>
        </div>
        <div class="box time">
          <p id="last_laptime">{lastLap}</p>
        </div>
      </div>

      <div id="top-bar">
        <div class="position-container">
          <span id="pilot_position">{entry?.position ?? ""}</span>
          <sup id="pos_ordinal">{ordinal(entry?.position ?? null)}</sup>
        </div>
      </div>

      <div class="bottom-bar">
        <div class="left-bar">
          <div id="pilot_callsign" class="nested-left">
            {entry?.callsign ?? ""}
          </div>
          <div class="nested-right" id="laps_label">
            LAPS: <span class="lap_number">{lapCount}</span>
          </div>
        </div>
        <div class="right-bar">
          <div id="total_time">{formatRankStat(entry, primary) || "0:00.000"}</div>
          <div class="laps-container">
            <LapList laps={laps} nodeData={nodeData} theme="lcdr" />
          </div>
        </div>
      </div>
    </main>
  );
}

export function NodeOverlay({ runtime }: NodeOverlayProps) {
  const raceState = useRaceState();
  const nodeIndex = runtime.node ?? 0;
  const theme = runtime.theme;
  const entry =
    raceState.leaderboard?.entries.find((candidate) => candidate.node === nodeIndex) ??
    null;
  const nodeData = asRecord(raceState.currentLaps?.nodeIndex?.[String(nodeIndex)]) as NodeLapData;
  const lapLimit = theme === "apex" ? 3 : DEFAULT_LAP_LIMIT;
  const laps = useMemo(() => {
    const allLaps = Array.isArray(nodeData.laps) ? nodeData.laps : [];
    return allLaps.slice(Math.max(allLaps.length - lapLimit, 0));
  }, [lapLimit, nodeData.laps]);
  const lapCount = entry?.laps ?? laps.length;
  const lastLap = entry?.lastLap ?? "00:00.000";
  const isPopupVisible = usePopup(lapCount);

  useEffect(() => {
    (globalThis as RotorHazardGlobals).rotorhazard ??= {};
    (globalThis as RotorHazardGlobals).rotorhazard!.show_messages = false;
  }, []);

  useEffect(() => {
    document.documentElement.classList.add(`${theme}-theme-page`);
    return () => {
      document.documentElement.classList.remove(`${theme}-theme-page`);
    };
  }, [theme]);

  useEffect(() => {
    applyHeatColor(raceState.currentHeat?.heatNodes, nodeIndex);
  }, [nodeIndex, raceState.currentHeat?.heatNodes]);

  if (theme === "apex") {
    return (
      <ApexNodeOverlay
        entry={entry}
        isPopupVisible={isPopupVisible}
        lapCount={lapCount}
        laps={laps}
        lastLap={lastLap}
        nodeData={nodeData}
        primary={raceState.leaderboard?.primary ?? null}
      />
    );
  }

  if (theme === "lcdr") {
    return (
      <LcdrNodeOverlay
        entry={entry}
        isPopupVisible={isPopupVisible}
        lapCount={lapCount}
        laps={laps}
        lastLap={lastLap}
        nodeData={nodeData}
        primary={raceState.leaderboard?.primary ?? null}
      />
    );
  }

  return (
    <DdsNodeOverlay
      entry={entry}
      isPopupVisible={isPopupVisible}
      lapCount={lapCount}
      laps={laps}
      lastLap={lastLap}
      nodeData={nodeData}
      primary={raceState.leaderboard?.primary ?? null}
    />
  );
}
