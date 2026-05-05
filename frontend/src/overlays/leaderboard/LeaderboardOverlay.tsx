import { useEffect, useRef, useState } from "preact/hooks";
import { ConnectionWarning } from "../../components/ConnectionWarning";
import type { OverlayRuntimeConfig } from "../../core/overlayRuntime";
import { useRaceState } from "../../core/raceStore";
import {
  selectClassResults,
  selectOverallResults,
  type ClassResults,
  type OverallResults,
} from "../../core/resultDataSelectors";
import type { LeaderboardEntry } from "../../core/rotorhazardTypes";

const ITEMS_PER_PAGE = 8;
const PAGE_INTERVAL_MS = 10_000;
const ENTRY_ANIM_STEP_MS = 100;
const HIDE_SETTLE_MS = ENTRY_ANIM_STEP_MS * ITEMS_PER_PAGE + 500;

type Props = { runtime: OverlayRuntimeConfig; view: "overall" | "class" };

// --- shared helpers ---

function positionColor(pos: number | null): string {
  if (pos === 1) return "gold";
  if (pos === 2) return "silver";
  if (pos === 3) return "#cd7f32";
  return "darkorange";
}

function NoData({ connection }: { connection: ReturnType<typeof useRaceState>["connection"] }) {
  return (
    <main class="page-streamclass">
      <ConnectionWarning connection={connection} />
      <div class="container">
        <div id="header">
          <h1>No Data</h1>
        </div>
        <div class="leaderboard" id="leaderboard">
          <p>There is no saved race data available to view.</p>
        </div>
      </div>
    </main>
  );
}

// --- overall view ---

function OverallEntry({ entry, animDelay }: { entry: LeaderboardEntry; animDelay: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), animDelay);
    return () => clearTimeout(t);
  }, [animDelay]);
  return (
    <div class={`entry${visible ? " show" : ""}`}>
      <div class="box position" style={{ backgroundColor: positionColor(entry.position) }}>
        <p>{entry.position}</p>
      </div>
      <p class="pilot_name">{entry.callsign ?? "—"}</p>
    </div>
  );
}

function OverallView({ title, entries }: OverallResults) {
  const columns: LeaderboardEntry[][] = [[], [], [], []];
  entries.slice(0, 32).forEach((e, i) => columns[Math.floor(i / ITEMS_PER_PAGE)].push(e));
  return (
    <main class="page-streamclass">
      <div class="container">
        <div id="header">
          <h1>{title}</h1>
        </div>
        <div class="leaderboard" id="leaderboard">
          {columns.map((col, ci) => (
            <div class="column" key={ci}>
              {col.map((entry, ei) => (
                <OverallEntry
                  key={entry.node ?? ei}
                  entry={entry}
                  animDelay={ENTRY_ANIM_STEP_MS * (ci * ITEMS_PER_PAGE + ei)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

// --- class view ---

type DisplayType = ClassResults["displayType"];

function gridTemplate(displayType: DisplayType): string {
  if (displayType === "by_race_time") return "repeat(3, 1fr)";
  return "repeat(2, 1fr)";
}

function headerLabels(displayType: DisplayType): string[] {
  if (displayType === "by_race_time") return ["LAPS", "AVG", "TOTAL"];
  if (displayType === "by_fastest_lap") return ["FASTEST LAP", "SOURCE"];
  if (displayType === "by_consecutives") return ["CONSECUTIVE", "SOURCE"];
  return [];
}

function EntryStats({ entry, displayType }: { entry: LeaderboardEntry; displayType: DisplayType }) {
  const raw = entry.raw;
  if (displayType === "by_race_time") {
    return (
      <div class="right" style={{ gridTemplateColumns: gridTemplate(displayType) }}>
        <p class="laps">{entry.laps ?? "—"}</p>
        <p class="avg">{String(raw.average_lap ?? "—")}</p>
        <p class="total_time">{entry.totalTime ?? "—"}</p>
      </div>
    );
  }
  if (displayType === "by_fastest_lap") {
    const src = raw.fastest_lap_source as { displayname?: string; round?: number } | undefined;
    return (
      <div class="right" style={{ gridTemplateColumns: gridTemplate(displayType) }}>
        <p class="fastest_lap">{String(raw.fastest_lap ?? "—")}</p>
        <p class="source">{src ? `${src.displayname} / Round ${src.round}` : "—"}</p>
      </div>
    );
  }
  if (displayType === "by_consecutives") {
    const src = raw.consecutives_source as { displayname?: string; round?: number } | undefined;
    return (
      <div class="right" style={{ gridTemplateColumns: gridTemplate(displayType) }}>
        <p class="consecutive">{`${raw.consecutives_base ?? "—"}/${raw.consecutives ?? "—"}`}</p>
        <p class="source">{src ? `${src.displayname} / Round ${src.round}` : "—"}</p>
      </div>
    );
  }
  return null;
}

function ClassEntry({
  entry,
  displayType,
  animDelay,
  hiding,
}: {
  entry: LeaderboardEntry;
  displayType: DisplayType;
  animDelay: number;
  hiding: boolean;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (hiding) { setVisible(false); return; }
    const t = setTimeout(() => setVisible(true), animDelay);
    return () => clearTimeout(t);
  }, [animDelay, hiding]);
  return (
    <div class={`entry${visible ? " show" : ""}${hiding ? " hide" : ""}`}>
      <div class="position" style={{ backgroundColor: positionColor(entry.position) }}>
        <p>{entry.position}</p>
      </div>
      <div class="info">
        <div class="left">
          <p class="pilot_name">{entry.callsign ?? "—"}</p>
        </div>
        <EntryStats entry={entry} displayType={displayType} />
      </div>
    </div>
  );
}

function ClassView({ title, entries, displayType }: ClassResults) {
  const [pageIndex, setPageIndex] = useState(0);
  const [hiding, setHiding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageCount = Math.ceil(entries.length / ITEMS_PER_PAGE);
  const paged = entries.slice(pageIndex * ITEMS_PER_PAGE, (pageIndex + 1) * ITEMS_PER_PAGE);
  const paginated = entries.length > ITEMS_PER_PAGE;
  const start = pageIndex * ITEMS_PER_PAGE + 1;
  const end = Math.min((pageIndex + 1) * ITEMS_PER_PAGE, entries.length);

  useEffect(() => { setPageIndex(0); setHiding(false); }, [entries]);

  useEffect(() => {
    if (!paginated) return;
    timerRef.current = setInterval(() => {
      setHiding(true);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      hideTimeoutRef.current = setTimeout(() => {
        setPageIndex((i) => (i + 1) % pageCount);
        setHiding(false);
        hideTimeoutRef.current = null;
      }, HIDE_SETTLE_MS);
    }, PAGE_INTERVAL_MS);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [entries, paginated, pageCount]);

  const labels = headerLabels(displayType);

  return (
    <main class="page-streamclass">
      <div class="container">
        <div id="header">
          <div class="left">
            <h1 id="title">{title}</h1>
          </div>
          <div class="right" style={{ gridTemplateColumns: labels.length > 0 ? gridTemplate(displayType) : undefined }}>
            {labels.map((label) => <p class="label" key={label}>{label}</p>)}
          </div>
        </div>
        <div class="leaderboard" id="leaderboard">
          {paged.map((entry, i) => (
            <ClassEntry
              key={`${pageIndex}-${entry.node ?? i}`}
              entry={entry}
              displayType={displayType}
              animDelay={ENTRY_ANIM_STEP_MS * i}
              hiding={hiding}
            />
          ))}
        </div>
        {paginated && (
          <div id="currentIndexIndicator">
            Showing {start}–{end} of {entries.length}
          </div>
        )}
      </div>
    </main>
  );
}

// --- main component ---

export function LeaderboardOverlay({ runtime, view }: Props) {
  const { connection, currentHeat, resultData } = useRaceState();

  if (view === "class") {
    const results = selectClassResults(resultData, runtime.classId, currentHeat);
    if (!results) return <NoData connection={connection} />;
    return (
      <>
        <ConnectionWarning connection={connection} />
        <ClassView {...results} />
      </>
    );
  }

  const results = selectOverallResults(resultData, runtime.classId, currentHeat);
  if (!results) return <NoData connection={connection} />;
  return (
    <>
      <ConnectionWarning connection={connection} />
      <OverallView {...results} />
    </>
  );
}
