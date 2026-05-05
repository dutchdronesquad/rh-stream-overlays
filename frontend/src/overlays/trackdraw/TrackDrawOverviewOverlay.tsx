import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { OverlayRuntimeConfig } from "../../core/overlayRuntime";
import { asNumber, asRecord, asString } from "../../core/primitives";
import { useRaceState } from "../../core/raceStore";
import { createTrackDrawRenderer } from "./trackCore/renderer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Pilot = {
  nodeIndex: number;
  callsign: string;
  color: string;
  active: boolean;
  position: number | null;
  lastLapAt: number | null;
};

type RaceStatusKey = "live" | "ended" | "idle" | "disconnected";

type ColorValGlobal = typeof globalThis & {
  colorvalToHex?: (val: unknown) => string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toHexColor(colorval: unknown): string {
  if (!colorval) return "#ffffff";
  if (typeof (globalThis as ColorValGlobal).colorvalToHex === "function") {
    return (globalThis as ColorValGlobal).colorvalToHex!(colorval);
  }
  if (typeof colorval === "string") return colorval;
  if (typeof colorval === "number") {
    return "#" + colorval.toString(16).padStart(6, "0");
  }
  return "#ffffff";
}

function getPilotLabel(pilot: Pilot): string {
  return (pilot.callsign || "N" + (pilot.nodeIndex + 1)).slice(0, 12).toUpperCase();
}

function getTrackJsonUrl(): string {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (/\/overview(?:$|\/)/.test(path)) {
    return path.replace(/\/overview(?:\/.*)?$/, "/overview/track.json");
  }
  return path.replace(/\/map(?:\/.*)?$/, "/track.json");
}

function getConfidence(
  pilot: Pilot,
  raceRunning: boolean,
  connected: boolean
): string {
  if (!connected) return "stale";
  if (!raceRunning) return "idle";
  if (pilot.lastLapAt && performance.now() - pilot.lastLapAt < 2500) return "high";
  return "medium";
}

// ---------------------------------------------------------------------------
// LeaderCard
// ---------------------------------------------------------------------------

type LeaderCardProps = {
  label: string;
};

function LeaderCard({ label }: LeaderCardProps) {
  const [isChanging, setIsChanging] = useState(false);
  const prevLabelRef = useRef<string>("");

  useEffect(() => {
    if (label !== prevLabelRef.current) {
      prevLabelRef.current = label;
      setIsChanging(false);
      // Force a microtask gap to let Preact flush the class removal before adding it back
      const raf = requestAnimationFrame(() => {
        setIsChanging(true);
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [label]);

  return (
    <section class="trackdraw-map__overview-card trackdraw-map__overview-card--leader">
      <span class="trackdraw-map__overview-kicker">Leader</span>
      <div class="trackdraw-map__overview-leader-wrap">
        <span class="trackdraw-map__overview-leader-pos" aria-hidden="true">P1</span>
        <strong
          id="trackdraw-overview-leader"
          class={`trackdraw-map__overview-leader${isChanging ? " is-changing" : ""}`}
        >
          {label}
        </strong>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PilotRow
// ---------------------------------------------------------------------------

type PilotRowProps = {
  pilot: Pilot;
  displayPosition: number;
  isP1: boolean;
  confidence: string;
  delta: "up" | "down" | null;
  onClearDelta: (nodeIndex: number) => void;
};

function PilotRow({ pilot, displayPosition, isP1, confidence, delta, onClearDelta }: PilotRowProps) {
  const [activeDelta, setActiveDelta] = useState<"up" | "down" | null>(delta);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (delta !== null) {
      setActiveDelta(delta);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setActiveDelta(null);
        onClearDelta(pilot.nodeIndex);
        timerRef.current = null;
      }, 3000);
    }
  }, [delta, pilot.nodeIndex]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const rowClass = [
    "trackdraw-map__overview-row",
    `is-${confidence}`,
    isP1 ? "trackdraw-map__overview-row--p1" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li
      class={rowClass}
      data-node-idx={String(pilot.nodeIndex)}
    >
      <span class="trackdraw-map__overview-pos">{displayPosition}</span>
      <span
        class="trackdraw-map__overview-swatch"
        style={{ background: pilot.color }}
      />
      <span class="trackdraw-map__overview-callsign">{getPilotLabel(pilot)}</span>
      <span
        class={`trackdraw-map__overview-delta${activeDelta ? ` is-${activeDelta}` : ""}`}
      >
        {activeDelta === "up" ? "▲" : activeDelta === "down" ? "▼" : ""}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// TrackDrawOverviewOverlay
// ---------------------------------------------------------------------------

export function TrackDrawOverviewOverlay({
  runtime,
}: {
  runtime: OverlayRuntimeConfig;
}) {
  const { connection, currentHeat, currentLaps, leaderboard, raceStatus } =
    useRaceState();

  // -- SVG renderer refs --
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    const renderer = createTrackDrawRenderer(svgRef.current, containerRef.current, runtime.theme);
    renderer.loadTrack();
    return () => renderer.destroy();
  }, []);

  // -- Track title --
  const [trackTitle, setTrackTitle] = useState<string>("Overview");

  useEffect(() => {
    const url = getTrackJsonUrl();
    fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("TrackDraw package unavailable.");
        return res.json() as Promise<unknown>;
      })
      .then((payload) => {
        const data = asRecord(payload);
        const track = asRecord(data.track);
        const title = asString(track.title);
        if (title) setTrackTitle(title);
      })
      .catch(() => {
        // Map renderer handles setup/error messaging.
      });
  }, []);

  // -- Theme on <html> --
  useEffect(() => {
    const cls = `${runtime.theme}-theme-page`;
    document.documentElement.classList.add(cls);
    return () => document.documentElement.classList.remove(cls);
  }, [runtime.theme]);

  // -- Pilots state --
  const [pilots, setPilots] = useState<Map<number, Pilot>>(new Map());

  // Rebuild pilots map when heat changes
  useEffect(() => {
    if (!currentHeat?.heatNodes) {
      setPilots(new Map());
      return;
    }
    const nodes = asRecord(currentHeat.heatNodes) as Record<
      string,
      { callsign?: unknown; activeColor?: unknown }
    >;
    const next = new Map<number, Pilot>();
    for (const key of Object.keys(nodes)) {
      const index = parseInt(key, 10);
      const node = asRecord(nodes[key]);
      const callsign = asString(node.callsign);
      if (!callsign) continue;
      next.set(index, {
        nodeIndex: index,
        callsign,
        color: toHexColor(node.activeColor),
        active: true,
        position: null,
        lastLapAt: null,
      });
    }
    setPilots(next);
  }, [currentHeat]);

  // Apply leaderboard positions / callsign updates
  useEffect(() => {
    if (!leaderboard?.entries.length) return;
    setPilots((prev) => {
      const next = new Map(prev);
      // Reset positions
      next.forEach((p, idx) => {
        next.set(idx, { ...p, position: null });
      });
      for (const entry of leaderboard.entries) {
        const nodeIdx = asNumber(entry.node);
        if (nodeIdx === null) continue;
        const existing = next.get(nodeIdx);
        if (!existing) continue;
        next.set(nodeIdx, {
          ...existing,
          position: entry.position,
          callsign: entry.callsign ?? existing.callsign,
        });
      }
      return next;
    });
  }, [leaderboard]);

  const prevLapCountsRef = useRef<Record<string, number>>({});

  // Update lastLapAt from currentLaps
  useEffect(() => {
    if (!currentLaps?.nodeIndex) return;
    const nodeIndex = currentLaps.nodeIndex;
    const changedNodes: number[] = [];
    for (const nodeIdx of Object.keys(nodeIndex)) {
      const nodeData = asRecord(nodeIndex[nodeIdx]);
      const laps = Array.isArray(nodeData.laps) ? nodeData.laps : [];
      const prevCount = prevLapCountsRef.current[nodeIdx] ?? 0;
      if (laps.length > prevCount) {
        changedNodes.push(parseInt(nodeIdx, 10));
      }
      prevLapCountsRef.current[nodeIdx] = laps.length;
    }
    if (changedNodes.length === 0) return;
    setPilots((prev) => {
      const next = new Map(prev);
      for (const idx of changedNodes) {
        const existing = next.get(idx);
        if (!existing) continue;
        next.set(idx, { ...existing, lastLapAt: performance.now() });
      }
      return next;
    });
  }, [currentLaps]);

  // -- Race status --
  const connected = connection.isConnected;
  const raceStatusKey: RaceStatusKey = !connected
    ? "disconnected"
    : raceStatus?.label === "running"
      ? "live"
      : raceStatus?.label === "stopped"
        ? "ended"
        : "idle";

  const raceRunning = raceStatusKey === "live";

  const raceStatusLabel: string = {
    live: "Live",
    ended: "Ended",
    idle: "Idle",
    disconnected: "Disconnected",
  }[raceStatusKey];

  // -- Sorted pilots (max 8) --
  const sortedPilots = useMemo(() => {
    const active = Array.from(pilots.values()).filter((p) => p.active);
    return active
      .sort((a, b) => {
        const hasA = a.position !== null && a.position > 0;
        const hasB = b.position !== null && b.position > 0;
        if (hasA && hasB && a.position !== b.position)
          return (a.position as number) - (b.position as number);
        if (hasA !== hasB) return hasA ? -1 : 1;
        return a.nodeIndex - b.nodeIndex;
      })
      .slice(0, 8);
  }, [pilots]);

  // -- Leader label --
  const leaderPilot = sortedPilots[0];
  const leaderHasPosition =
    leaderPilot != null &&
    leaderPilot.position !== null &&
    (leaderPilot.position as number) > 0;
  const leaderLabel = leaderHasPosition ? getPilotLabel(leaderPilot) : "--";

  // -- Delta tracking --
  const prevOrderRef = useRef<Map<number, number>>(new Map());
  const deltasRef = useRef<Map<number, "up" | "down">>(new Map());

  // Compute deltas before committing to prevOrder
  const deltas = new Map<number, "up" | "down">();
  sortedPilots.forEach((pilot, index) => {
    const newPos = index + 1;
    const oldPos = prevOrderRef.current.get(pilot.nodeIndex);
    if (oldPos !== undefined && oldPos !== newPos) {
      deltas.set(pilot.nodeIndex, oldPos > newPos ? "up" : "down");
    }
  });
  // Merge persistent deltas (cleared by PilotRow after 3 s)
  deltas.forEach((dir, nodeIdx) => {
    if (deltasRef.current.get(nodeIdx) !== dir) {
      deltasRef.current.set(nodeIdx, dir);
    }
  });

  const clearDelta = (nodeIdx: number) => {
    deltasRef.current.delete(nodeIdx);
  };

  // Update prevOrder after render
  useEffect(() => {
    const next = new Map<number, number>();
    sortedPilots.forEach((p, i) => next.set(p.nodeIndex, i + 1));
    prevOrderRef.current = next;
  }, [sortedPilots]);

  // -- FLIP animation --
  const listRef = useRef<HTMLOListElement>(null);
  const prevTopRef = useRef<Map<number, number>>(new Map());

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const children = Array.from(list.children) as HTMLElement[];
    children.forEach((row) => {
      const nodeIdx = Number(row.dataset.nodeIdx);
      const prevTop = prevTopRef.current.get(nodeIdx);
      const currentTop = row.getBoundingClientRect().top;
      if (prevTop !== undefined) {
        const delta = prevTop - currentTop;
        if (Math.abs(delta) > 2) {
          row.style.transition = "none";
          row.style.transform = `translateY(${delta}px)`;
          row.getBoundingClientRect(); // force reflow
          row.style.transition =
            "transform 450ms cubic-bezier(0.25, 0.46, 0.45, 0.94)";
          row.style.transform = "";
        }
      }
      prevTopRef.current.set(nodeIdx, currentTop);
    });
  }, [sortedPilots]);

  return (
    <main
      class="trackdraw-map trackdraw-map--overview"
      data-theme={runtime.theme}
      data-variant="overview"
      ref={containerRef}
    >
      <section class="trackdraw-map__panel trackdraw-map__overview-panel">
        <div class="trackdraw-map__overview-shell">
          <header class="trackdraw-map__overview-header">
            <div class="trackdraw-map__overview-title-group">
              <span class="trackdraw-map__overview-brand">TrackDraw</span>
              <h1
                id="trackdraw-overview-title"
                class="trackdraw-map__overview-title"
              >
                {trackTitle}
              </h1>
            </div>
            {raceStatusKey !== "idle" && (
              <span
                id="trackdraw-overview-race-status"
                class="trackdraw-map__overview-race-status"
                data-status={raceStatusKey}
              >
                {raceStatusLabel}
              </span>
            )}
          </header>
          <div class="trackdraw-map__overview-body">
            <div class="trackdraw-map__overview-stage">
              <svg
                ref={svgRef}
                id="trackdraw-map-svg"
                class="trackdraw-map__svg"
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="TrackDraw live overview map"
              />
              <div
                id="trackdraw-map-message"
                class="trackdraw-map__message is-visible"
              >
                Loading TrackDraw map...
              </div>
            </div>
            <aside class="trackdraw-map__overview-sidebar">
              <LeaderCard label={leaderLabel} />
              <section class="trackdraw-map__overview-card trackdraw-map__overview-card--pilots">
                <span class="trackdraw-map__overview-kicker">Pilots</span>
                <ol
                  id="trackdraw-overview-leaderboard"
                  class="trackdraw-map__overview-leaderboard"
                  ref={listRef}
                >
                  {sortedPilots.map((pilot, index) => {
                    const posVal = pilot.position;
                    const displayPosition =
                      posVal !== null && (posVal as number) > 0
                        ? (posVal as number)
                        : index + 1;
                    const isP1 = displayPosition === 1;
                    const confidence = getConfidence(pilot, raceRunning, connected);
                    const delta =
                      deltas.get(pilot.nodeIndex) ??
                      deltasRef.current.get(pilot.nodeIndex) ??
                      null;
                    return (
                      <PilotRow
                        key={pilot.nodeIndex}
                        pilot={pilot}
                        displayPosition={displayPosition}
                        isP1={isP1}
                        confidence={confidence}
                        delta={delta}
                        onClearDelta={clearDelta}
                      />
                    );
                  })}
                </ol>
              </section>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
