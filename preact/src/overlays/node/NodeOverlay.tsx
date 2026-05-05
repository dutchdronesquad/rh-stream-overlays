import { useEffect, useRef, useState } from "preact/hooks";
import { ConnectionWarning } from "../../components/ConnectionWarning";
import { contrastHex, formatCallsign } from "../../core/formatting";
import type { OverlayRuntimeConfig } from "../../core/overlayRuntime";
import { asNumber, asRecord, asString, objectValues } from "../../core/primitives";
import { useRaceState } from "../../core/raceStore";
import { apexTheme } from "../../themes/apex";
import { ddsTheme } from "../../themes/dds";
import { lcdrTheme } from "../../themes/lcdr";
import type { OverlayThemeConfig } from "../../themes/apex";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LapItem = {
  lapNumber: number;
  lapIndex: number;
  lapTimeFormatted: string;
  lapRaw: number;
  isFastest: boolean;
  isFromStart: boolean;
  isMinLapWarning: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ColorValGlobals = typeof globalThis & {
  colorvalToHex?: (val: unknown) => string;
};

function resolveColor(value: unknown): string | null {
  if (value == null) return null;
  const fn = (globalThis as ColorValGlobals).colorvalToHex;
  if (fn) return fn(value);
  if (typeof value === "string" && value !== "") return value;
  if (typeof value === "number") return `#${value.toString(16).padStart(6, "0")}`;
  return null;
}

function themeConfig(name: string): OverlayThemeConfig {
  if (name === "apex") return apexTheme;
  if (name === "lcdr") return lcdrTheme;
  return ddsTheme;
}

function ordinal(pos: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const mod = pos % 100;
  return mod >= 11 && mod <= 13 ? "th" : (suffixes[pos % 10] ?? "th");
}

// ---------------------------------------------------------------------------
// Lap list helpers
// ---------------------------------------------------------------------------

function buildLapItems(
  nodeData: Record<string, unknown>,
  limit: number
): LapItem[] {
  const lapsRaw = objectValues(nodeData.laps);
  const fastestIndex = asNumber(nodeData.fastest_lap_index);

  const items: LapItem[] = lapsRaw.map((lap) => {
    const l = asRecord(lap);
    const lapNumber = asNumber(l.lap_number) ?? 0;
    const lapIndex = asNumber(l.lap_index) ?? 0;
    const lapRaw = asNumber(l.lap_raw) ?? 0;
    const lapTimeFormatted =
      asString(l.lap_time_formatted) ?? asString(l.lap_time) ?? "—";
    return {
      lapNumber,
      lapIndex,
      lapRaw,
      lapTimeFormatted,
      isFastest: fastestIndex !== null && lapIndex === fastestIndex,
      isFromStart: lapNumber === 0,
      isMinLapWarning: lapRaw > 0 && lapRaw < 1500,
    };
  });

  return items.slice(-limit);
}

// ---------------------------------------------------------------------------
// DDS / LCDR lap items
// ---------------------------------------------------------------------------

function LapItemDDS({ item }: { item: LapItem }) {
  const classes = [
    item.isFromStart ? "from_start" : "",
    item.isFastest ? "fastest_lap" : "",
    item.isMinLapWarning ? "min-lap-warning" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const label = item.isFromStart ? "S" : String(item.lapNumber);

  return (
    <li class={classes || undefined}>
      {label}| {item.lapTimeFormatted}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Apex lap items
// ---------------------------------------------------------------------------

function LapItemApex({ item, isNew }: { item: LapItem; isNew: boolean }) {
  const [showNew, setShowNew] = useState(isNew);

  useEffect(() => {
    if (!isNew) return;
    setShowNew(true);
    const t = setTimeout(() => setShowNew(false), 400);
    return () => clearTimeout(t);
  }, [isNew]);

  const classes = [
    item.isFromStart ? "from_start" : "",
    item.isFastest ? "fastest-lap" : "",
    item.isMinLapWarning ? "min-lap-warning" : "",
    showNew ? "new-lap" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const label = item.isFromStart ? "S" : String(item.lapNumber);

  return (
    <li class={classes || undefined}>
      <div class="lap-num-box">{label}</div>
      <div class="lap-time-box">{item.lapTimeFormatted}</div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// DDS layout
// ---------------------------------------------------------------------------

function DdsLayout({
  position,
  posOrdinal,
  callsign,
  lapCount,
  lastLap,
  totalTime,
  lapItems,
  popupTop,
}: {
  position: string;
  posOrdinal: string;
  callsign: string;
  lapCount: number;
  lastLap: string;
  totalTime: string;
  lapItems: LapItem[];
  popupTop: string;
}) {
  return (
    <main class="page-streamnode">
      <div
        id="popup-container"
        style={{ top: popupTop, transition: "top 0.5s ease" }}
      >
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
          <span id="pilot_position">{position}</span>
          <sup id="pos_ordinal">{posOrdinal}</sup>
        </div>
      </div>
      <div class="overlay-bottom">
        <div class="row first-bar">
          <div id="pilot_callsign">{callsign}</div>
          <div class="align-right" id="laps_label">
            LAPS: <span class="lap_number">{lapCount}</span>
          </div>
        </div>
        <div class="row second-bar">
          <div class="laps-container">
            <ul id="pilot_lap-times">
              {lapItems.map((item) => (
                <LapItemDDS key={item.lapIndex} item={item} />
              ))}
            </ul>
          </div>
          <div class="align-right" id="total_time">
            {totalTime}
          </div>
        </div>
        <div class="triangle bottom"></div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// LCDR layout
// ---------------------------------------------------------------------------

function LcdrLayout({
  position,
  posOrdinal,
  callsign,
  lapCount,
  lastLap,
  totalTime,
  lapItems,
  popupTop,
}: {
  position: string;
  posOrdinal: string;
  callsign: string;
  lapCount: number;
  lastLap: string;
  totalTime: string;
  lapItems: LapItem[];
  popupTop: string;
}) {
  return (
    <main class="page-streamnode">
      <div
        id="popup-container"
        style={{ top: popupTop, transition: "top 0.5s ease" }}
      >
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
          <span id="pilot_position">{position}</span>
          <sup id="pos_ordinal">{posOrdinal}</sup>
        </div>
      </div>
      <div class="bottom-bar">
        <div class="left-bar">
          <div id="pilot_callsign" class="nested-left">
            {callsign}
          </div>
          <div class="nested-right" id="laps_label">
            LAPS: <span class="lap_number">{lapCount}</span>
          </div>
        </div>
        <div class="right-bar">
          <div id="total_time">{totalTime}</div>
          <div class="laps-container">
            <ul id="pilot_lap-times">
              {lapItems.map((item) => (
                <LapItemDDS key={item.lapIndex} item={item} />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Apex layout
// ---------------------------------------------------------------------------

function ApexLayout({
  position,
  posOrdinal,
  callsign,
  lapCount,
  lastLap,
  totalTime,
  lapItems,
  showPopup,
  prevLapCount,
}: {
  position: string;
  posOrdinal: string;
  callsign: string;
  lapCount: number;
  lastLap: string;
  totalTime: string;
  lapItems: LapItem[];
  showPopup: boolean;
  prevLapCount: number;
}) {
  return (
    <main class="page-streamnode apex-theme">
      <div id="popup-container" class={showPopup ? "show" : ""}>
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
          {position}
        </span>
        <sup class="position-ordinal" id="pos_ordinal">
          {posOrdinal}
        </sup>
      </div>
      <div class="apex-overlay-container">
        <div class="info-card">
          <div class="pilot-header">
            <div class="pilot-callsign" id="pilot_callsign">
              {callsign}
            </div>
            <div class="pilot-laps">
              <span class="lap-label">LAP</span>
              <span class="lap_number">{lapCount}</span>
            </div>
          </div>
          <div class="time-display">
            <div class="total-time" id="total_time">
              {totalTime}
            </div>
          </div>
          <div class="laps-section">
            <ul class="laps-list" id="pilot_lap-times">
              {lapItems.map((item) => (
                <LapItemApex
                  key={item.lapIndex}
                  item={item}
                  isNew={item.lapIndex === lapCount - 1 && lapCount > prevLapCount}
                />
              ))}
            </ul>
          </div>
        </div>
        <div class="accent-bar"></div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function NodeOverlay({ runtime }: { runtime: OverlayRuntimeConfig }) {
  const state = useRaceState();
  const nodeIndex = runtime.node ?? 0;
  const theme = themeConfig(runtime.theme);

  // --- extract leaderboard entry ---
  const entry = state.leaderboard?.entries.find((e) => e.node === nodeIndex) ?? null;
  const position = entry?.position ?? null;
  const callsign = formatCallsign(entry?.callsign ?? null, "—");
  const lapCount = entry?.laps ?? 0;
  const lastLap = entry?.lastLap ?? "—";
  const totalTime = entry?.totalTime ?? "—";
  const posStr = position !== null ? String(position) : "—";
  const posOrdinal = position !== null ? ordinal(position) : "";

  // --- extract node laps ---
  const nodeData = asRecord(state.currentLaps?.nodeIndex?.[String(nodeIndex)]);
  const lapItems = buildLapItems(nodeData, theme.lapDisplayLimit);

  // --- pilot color ---
  const heatNodes = asRecord(state.currentHeat?.heatNodes);
  const nodeInfo = asRecord(heatNodes[String(nodeIndex)]);
  const rawColor = nodeInfo.activeColor ?? null;
  const pilotColor = resolveColor(rawColor) ?? "#ffffff";

  useEffect(() => {
    const root = document.documentElement;
    const contrast = contrastHex(pilotColor);
    root.style.setProperty("--pilot_color", pilotColor);
    root.style.setProperty("--contrast_pilot_color", contrast);
    root.style.setProperty("--position_foreground_color", pilotColor);
    root.style.setProperty("--position_background_color", contrast);
    root.style.setProperty("--fast_lap_color", pilotColor);
    root.style.setProperty("--contrast_fast_lap_color", contrast);
  }, [pilotColor]);

  // --- theme class on <html> ---
  useEffect(() => {
    const cls = `${runtime.theme}-theme-page`;
    document.documentElement.classList.add(cls);
    return () => document.documentElement.classList.remove(cls);
  }, [runtime.theme]);

  // --- popup animation ---
  const prevLapCountRef = useRef(lapCount);
  const [popupTop, setPopupTop] = useState("-50%");
  const [showPopup, setShowPopup] = useState(false);
  const [prevLapCount, setPrevLapCount] = useState(lapCount);

  useEffect(() => {
    const prev = prevLapCountRef.current;
    if (lapCount > prev && prev >= 0) {
      if (theme.nodeAnimation === "zoom") {
        setShowPopup(true);
        const t = setTimeout(() => setShowPopup(false), 2900);
        return () => clearTimeout(t);
      } else {
        setPopupTop("45%");
        const t = setTimeout(() => setPopupTop("-50%"), 3000);
        return () => clearTimeout(t);
      }
    }
  }, [lapCount, theme.nodeAnimation]);

  useEffect(() => {
    setPrevLapCount(prevLapCountRef.current);
    prevLapCountRef.current = lapCount;
  }, [lapCount]);

  const layoutProps = {
    position: posStr,
    posOrdinal,
    callsign,
    lapCount,
    lastLap,
    totalTime,
    lapItems,
  };

  return (
    <>
      <ConnectionWarning connection={state.connection} />
      {runtime.theme === "apex" ? (
        <ApexLayout
          {...layoutProps}
          showPopup={showPopup}
          prevLapCount={prevLapCount}
        />
      ) : runtime.theme === "lcdr" ? (
        <LcdrLayout {...layoutProps} popupTop={popupTop} />
      ) : (
        <DdsLayout {...layoutProps} popupTop={popupTop} />
      )}
    </>
  );
}
