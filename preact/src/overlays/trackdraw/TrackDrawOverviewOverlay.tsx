import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { OverlayRuntimeConfig } from "../../core/overlayRuntime";
import { useRaceState } from "../../core/raceStore";
import type { RawRecord } from "../../core/rotorhazardTypes";

type TrackDrawOverviewOverlayProps = {
  runtime: OverlayRuntimeConfig;
};

type OverviewPilot = {
  active: boolean;
  callsign: string;
  color: string;
  lastLapAt: number | null;
  nodeIndex: number;
  position: number | null;
};

type TrackPayload = {
  ok?: boolean;
  track?: {
    title?: string;
  };
};

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

function colorValueToHex(value: unknown): string {
  const color = asNumber(value);
  if (color === null) {
    return "#ffffff";
  }

  return `#${color.toString(16).padStart(6, "0").slice(-6)}`;
}

function pilotLabel(pilot: OverviewPilot): string {
  return (pilot.callsign || `N${pilot.nodeIndex + 1}`).slice(0, 12).toUpperCase();
}

function trackJsonUrl(): string {
  const path = window.location.pathname.replace(/\/+$/, "");
  return /\/overview$/.test(path) ? `${path}/track.json` : path.replace(/\/map$/, "/track.json");
}

function confidence(
  pilot: OverviewPilot,
  isConnected: boolean,
  isRaceRunning: boolean
): "high" | "idle" | "medium" | "stale" {
  if (!isConnected) {
    return "stale";
  }

  if (!isRaceRunning) {
    return "idle";
  }

  if (pilot.lastLapAt && window.performance.now() - pilot.lastLapAt < 2500) {
    return "high";
  }

  return "medium";
}

function sortPilots(pilots: OverviewPilot[]): OverviewPilot[] {
  return [...pilots].filter((pilot) => pilot.active).sort((a, b) => {
    const posA = Number(a.position);
    const posB = Number(b.position);
    const hasA = !Number.isNaN(posA) && posA > 0;
    const hasB = !Number.isNaN(posB) && posB > 0;

    if (hasA && hasB && posA !== posB) {
      return posA - posB;
    }

    if (hasA !== hasB) {
      return hasA ? -1 : 1;
    }

    return a.nodeIndex - b.nodeIndex;
  });
}

function useTrackTitle(): string {
  const [title, setTitle] = useState("Overview");

  useEffect(() => {
    let isCancelled = false;

    fetch(trackJsonUrl(), { headers: { Accept: "application/json" }, cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("TrackDraw package unavailable.");
        }
        return response.json() as Promise<TrackPayload>;
      })
      .then((payload) => {
        if (!isCancelled && payload.track?.title) {
          setTitle(payload.track.title);
        }
      })
      .catch(() => undefined);

    return () => {
      isCancelled = true;
    };
  }, []);

  return title;
}

function useLastLapTimes(nodeIndex: RawRecord | null): Record<string, number> {
  const previousLapCounts = useRef<Record<string, number>>({});
  const [lastLapTimes, setLastLapTimes] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!nodeIndex) {
      return;
    }

    let changed = false;
    const nextLapTimes = { ...lastLapTimes };
    Object.entries(nodeIndex).forEach(([nodeIdx, nodeData]) => {
      const laps = asRecord(nodeData).laps;
      const lapCount = Array.isArray(laps) ? laps.length : 0;
      if (lapCount > (previousLapCounts.current[nodeIdx] ?? 0)) {
        nextLapTimes[nodeIdx] = window.performance.now();
        changed = true;
      }
      previousLapCounts.current[nodeIdx] = lapCount;
    });

    if (changed) {
      setLastLapTimes(nextLapTimes);
    }
  }, [lastLapTimes, nodeIndex]);

  return lastLapTimes;
}

export function TrackDrawOverviewOverlay({ runtime }: TrackDrawOverviewOverlayProps) {
  const raceState = useRaceState();
  const title = useTrackTitle();
  const lastLapTimes = useLastLapTimes(raceState.currentLaps?.nodeIndex ?? null);
  const previousPositions = useRef<Record<string, number>>({});
  const [deltas, setDeltas] = useState<Record<string, "down" | "up">>({});
  const isRaceRunning = raceState.raceStatus?.status === 1;
  const pilots = useMemo(() => {
    const heatNodes = asRecord(raceState.currentHeat?.heatNodes);
    const byNode: Record<string, OverviewPilot> = {};

    Object.entries(heatNodes).forEach(([nodeIdx, nodeData]) => {
      const node = asRecord(nodeData);
      const nodeIndex = asNumber(nodeIdx) ?? 0;
      const callsign = asText(node.callsign);
      if (!callsign) {
        return;
      }

      byNode[nodeIdx] = {
        active: true,
        callsign,
        color: colorValueToHex(node.activeColor),
        lastLapAt: lastLapTimes[nodeIdx] ?? null,
        nodeIndex,
        position: null
      };
    });

    raceState.leaderboard?.entries.forEach((entry) => {
      if (entry.node === null) {
        return;
      }

      const pilot = byNode[String(entry.node)];
      if (!pilot) {
        return;
      }

      pilot.position = entry.position;
      if (entry.callsign) {
        pilot.callsign = entry.callsign;
      }
    });

    return sortPilots(Object.values(byNode));
  }, [
    lastLapTimes,
    raceState.currentHeat?.heatNodes,
    raceState.leaderboard?.entries
  ]);

  useEffect(() => {
    const nextDeltas: Record<string, "down" | "up"> = {};
    pilots.forEach((pilot, index) => {
      const nodeIdx = String(pilot.nodeIndex);
      const newPosition = index + 1;
      const oldPosition = previousPositions.current[nodeIdx];
      if (oldPosition !== undefined && oldPosition !== newPosition) {
        nextDeltas[nodeIdx] = oldPosition > newPosition ? "up" : "down";
      }
      previousPositions.current[nodeIdx] = newPosition;
    });

    setDeltas(nextDeltas);
    if (Object.keys(nextDeltas).length) {
      const timeoutId = window.setTimeout(() => {
        setDeltas({});
      }, 3000);
      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    return undefined;
  }, [pilots]);

  const leader = pilots[0];
  const leaderHasPosition = leader && leader.position !== null && leader.position > 0;

  return (
    <main
      class="trackdraw-map trackdraw-map--overview"
      data-theme={runtime.theme}
      data-variant="overview"
    >
      <section class="trackdraw-map__panel trackdraw-map__overview-panel">
        <div class="trackdraw-map__overview-shell">
          <header class="trackdraw-map__overview-header">
            <div class="trackdraw-map__overview-title-group">
              <span class="trackdraw-map__overview-brand">TrackDraw</span>
              <h1 id="trackdraw-overview-title" class="trackdraw-map__overview-title">
                {title}
              </h1>
            </div>
          </header>
          <div class="trackdraw-map__overview-body">
            <div class="trackdraw-map__overview-stage">
              <svg
                id="trackdraw-map-svg"
                class="trackdraw-map__svg"
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="TrackDraw live overview map"
              />
              <div id="trackdraw-map-message" class="trackdraw-map__message is-visible">
                Loading TrackDraw map...
              </div>
            </div>
            <aside class="trackdraw-map__overview-sidebar">
              <section class="trackdraw-map__overview-card trackdraw-map__overview-card--leader">
                <span class="trackdraw-map__overview-kicker">Leader</span>
                <div class="trackdraw-map__overview-leader-wrap">
                  <span class="trackdraw-map__overview-leader-pos" aria-hidden="true">
                    P1
                  </span>
                  <strong id="trackdraw-overview-leader" class="trackdraw-map__overview-leader">
                    {leader && leaderHasPosition ? pilotLabel(leader) : "--"}
                  </strong>
                </div>
              </section>
              <section class="trackdraw-map__overview-card trackdraw-map__overview-card--pilots">
                <span class="trackdraw-map__overview-kicker">Pilots</span>
                <ol id="trackdraw-overview-leaderboard" class="trackdraw-map__overview-leaderboard">
                  {pilots.slice(0, 8).map((pilot, index) => {
                    const position =
                      pilot.position !== null && pilot.position > 0
                        ? pilot.position
                        : index + 1;
                    const delta = deltas[String(pilot.nodeIndex)];
                    const confidenceClass = confidence(
                      pilot,
                      raceState.connection.isConnected,
                      isRaceRunning
                    );

                    return (
                      <li
                        class={`trackdraw-map__overview-row is-${confidenceClass}${
                          position === 1 ? " trackdraw-map__overview-row--p1" : ""
                        }`}
                        data-node-idx={pilot.nodeIndex}
                        key={pilot.nodeIndex}
                      >
                        <span class="trackdraw-map__overview-pos">{position}</span>
                        <span
                          class="trackdraw-map__overview-swatch"
                          style={{ background: pilot.color }}
                        />
                        <span class="trackdraw-map__overview-callsign">
                          {pilotLabel(pilot)}
                        </span>
                        <span
                          class={`trackdraw-map__overview-delta${
                            delta ? ` is-${delta}` : ""
                          }`}
                        >
                          {delta === "up" ? "▲" : delta === "down" ? "▼" : ""}
                        </span>
                      </li>
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
