import { contrastHex } from "@/core/formatting";
import { subscribeRaceState, getRaceState } from "@/core/raceStore";
import { asRecord } from "@/core/primitives";
import type { LeaderboardEntry } from "@/core/rotorhazardTypes";

import type {
  AnchorModel,
  HeatNode,
  PilotElements,
  PilotState,
  Point,
  TrackData,
} from "./types";
import {
  createSvgElement,
  roundedRectPath,
  getVisualPoint,
  getRoutePath,
  hasValidField,
  hasPoint,
  setSafeViewBox,
} from "./geometry";
import {
  progressToPointWithAngle,
} from "./progress";
import {
  buildTrackModel,
  getExpectedSegmentMs,
  getNextAnchor,
  getValidDurationEstimateMs,
} from "./model";
import {
  createPilot,
  estimateProgress,
  freezePilots,
  getActiveLaps,
  getConfiguredMinLapMs,
  getPilotConfidence,
  isPilotCorrecting,
  learnLapSamples,
  setPilotAnchor,
} from "./pilotState";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LAP_MS = 30000;

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

type ColorValGlobal = typeof globalThis & {
  colorvalToHex?: (val: unknown) => string;
};

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

function getContrastColor(color: string): string {
  return contrastHex(color);
}

// ---------------------------------------------------------------------------
// TrackDraw renderer public API
// ---------------------------------------------------------------------------

export type TrackDrawRenderer = {
  loadTrack(): void;
  onConnect(): void;
  onDisconnect(): void;
  onHeat(heatNodes: Record<string, HeatNode>): void;
  onRaceStatus(status: number): void;
  onCurrentLaps(nodeIndex: Record<string, unknown>): void;
  onLeaderboard(entries: Array<{ node?: number | null; position?: number | null; callsign?: string | null }>): void;
  onResize(): void;
  destroy(): void;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTrackDrawRenderer(
  svgEl: SVGSVGElement,
  rootEl: Element,
  theme: string
): TrackDrawRenderer {

  // ---- Mutable renderer state ----
  let trackData: TrackData | null = null;
  let sampledPoints: Point[] = [];
  let splitProgressMap: Record<number, number> = {};
  let anchorModel: AnchorModel = {
    startFinishProgress: 0,
    startFinishKey: "sf",
    orderedSplits: [],
  };

  let pilots: Record<string, PilotState> = {};
  let prevLapCounts: Record<string, number> = {};
  let prevSplitCounts: Record<string, number> = {};

  let raceRunning = false;
  let socketConnected = true;
  let baselineLapMs = DEFAULT_LAP_MS;
  let trackLoadPending = false;
  let animationRunning = false;
  let animationFrameId: number | null = null;
  let destroyed = false;

  let fieldScale = 72;
  let visualScale = 1.0;

  // Pilot group SVG element
  let pilotGroupEl: SVGGElement | null = null;

  // WeakMap replaces duck-typed _trackdrawEls property
  const pilotElsMap = new WeakMap<SVGGElement, PilotElements>();

  // ---- Label directions ----
  const LABEL_DIRECTIONS: Array<{ x: number; y: number }> = [
    { x: 0, y: -1 },
    { x: 0.68, y: -0.73 },
    { x: -0.68, y: -0.73 },
    { x: 0.96, y: -0.28 },
    { x: -0.96, y: -0.28 },
    { x: 0, y: 1 },
  ];

  // ---- Store subscription ----
  let prevConnected: boolean | null = null;

  const unsubscribeStore = subscribeRaceState(() => {
    const state = getRaceState();
    const connected = state.connection.isConnected;

    if (prevConnected !== null && connected !== prevConnected) {
      if (connected) {
        renderer.onConnect();
      } else {
        renderer.onDisconnect();
      }
    }
    prevConnected = connected;

    // Heat nodes
    if (state.currentHeat?.heatNodes) {
      renderer.onHeat(asRecord(state.currentHeat.heatNodes) as Record<string, HeatNode>);
    }

    // Race status
    if (state.raceStatus?.status !== null && state.raceStatus?.status !== undefined) {
      renderer.onRaceStatus(state.raceStatus.status as number);
    }

    // Current laps
    if (state.currentLaps?.nodeIndex) {
      renderer.onCurrentLaps(state.currentLaps.nodeIndex as Record<string, unknown>);
    }

    // Leaderboard
    if (state.leaderboard?.entries?.length) {
      renderer.onLeaderboard(state.leaderboard.entries as LeaderboardEntry[]);
    }
  });

  // ---- Helpers ----

  function getRoot(): Element {
    return rootEl;
  }

  function showMessage(text: string): void {
    const msgEl = svgEl.parentElement?.querySelector("#trackdraw-map-message");
    if (msgEl) {
      msgEl.textContent = text || "TrackDraw map is not ready.";
      msgEl.classList.add("is-visible");
    }
  }

  function hideMessage(): void {
    const msgEl = svgEl.parentElement?.querySelector("#trackdraw-map-message");
    if (msgEl) msgEl.classList.remove("is-visible");
  }

  function clearSvg(): void {
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
  }

  function applyViewportClass(): void {
    const root = getRoot();
    if (!root) return;
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    const height = window.innerHeight || document.documentElement.clientHeight || 0;
    const aspect = height > 0 ? width / height : 16 / 9;
    const is16x9 = Math.abs(aspect - 16 / 9) < 0.04;
    const compact = width < 560 || height < 360;
    const tiny = width < 380 || height < 250;
    root.classList.toggle("is-compact", compact);
    root.classList.toggle("is-tiny", tiny);
    root.classList.toggle("is-obs-1080", is16x9 && width >= 1800 && height >= 1000);
    root.classList.toggle(
      "is-obs-720",
      is16x9 && width >= 1180 && width < 1800 && height >= 650
    );
  }

  function updatePilotDensityClass(activeCount: number): void {
    const root = getRoot();
    if (!root) return;
    root.classList.toggle("is-crowded", activeCount >= 5);
    root.classList.toggle("is-packed", activeCount >= 7);
  }

  function getBaselineLapMs(): number {
    return baselineLapMs || DEFAULT_LAP_MS;
  }

  function applyBaselineToUnlearnedPilots(): void {
    for (const nodeIdx of Object.keys(pilots)) {
      const pilot = pilots[nodeIdx];
      if (!pilot || pilot.hasLearnedPace === true) continue;
      pilot.expectedLapMs = getBaselineLapMs();
      pilot.expectedSegmentMs = getExpectedSegmentMs(
        pilot,
        pilot.lastAnchorProgress,
        pilot.nextAnchorProgress,
        pilot.lastAnchorKey,
        pilot.nextAnchorKey,
        anchorModel,
        baselineLapMs
      );
    }
  }

  function setBaselineLapMs(track: TrackData): void {
    baselineLapMs = getValidDurationEstimateMs(track) ?? DEFAULT_LAP_MS;
    applyBaselineToUnlearnedPilots();
  }

  function getTrackJsonUrl(): string {
    const path = window.location.pathname.replace(/\/+$/, "");
    return /\/map$/.test(path)
      ? path.replace(/\/map$/, "/track.json")
      : path + "/track.json";
  }

  function getReadinessMessage(payload: Record<string, unknown>): string {
    const readiness =
      payload.diagnostics &&
      typeof payload.diagnostics === "object" &&
      (payload.diagnostics as Record<string, unknown>).readiness;
    if (!readiness || typeof readiness !== "object") {
      return (typeof payload.error === "string" ? payload.error : null) ?? "TrackDraw setup is incomplete.";
    }
    const r = readiness as {
      summary?: string;
      issues?: Array<{ message?: string; type?: string; detail?: string }>;
      issue_count?: number;
    };
    if (!r.summary) {
      return (typeof payload.error === "string" ? payload.error : null) ?? "TrackDraw setup is incomplete.";
    }
    const lines = [r.summary];
    (r.issues ?? []).slice(0, 4).forEach((issue) => {
      let line = "- " + (issue.message ?? issue.type ?? "Readiness issue");
      if (issue.detail) line += " (" + issue.detail + ")";
      lines.push(line);
    });
    if (typeof r.issue_count === "number" && r.issue_count > 4) {
      lines.push("- " + (r.issue_count - 4) + " more issue(s)");
    }
    return lines.join("\n");
  }

  // ---- Track rendering ----

  function renderFinishLine(svg: SVGSVGElement, pt: Point, angle: number, r: number): void {
    const tickSize = r * 2.8;
    const finishLine = createSvgElement("g", {
      class: "trackdraw-map__finish-line",
      transform:
        "translate(" + pt.x + " " + pt.y + ") rotate(" + (angle * 180) / Math.PI + ")",
    });

    for (const side of [-1, 1]) {
      const cap = createSvgElement("rect", {
        class: "trackdraw-map__finish-line-cap",
        x: -r * 0.75,
        y: side * tickSize - r * 0.34,
        width: r * 1.5,
        height: r * 0.68,
        rx: r * 0.12,
      });
      cap.style.strokeWidth = String(r * 0.08);
      finishLine.appendChild(cap);
    }

    const blockRows = 6;
    const blockH = (tickSize * 2) / blockRows;
    const blockW = r * 0.52;
    for (let row = 0; row < blockRows; row++) {
      for (let col = 0; col < 2; col++) {
        finishLine.appendChild(
          createSvgElement("rect", {
            class:
              (row + col) % 2 === 0
                ? "trackdraw-map__finish-block is-light"
                : "trackdraw-map__finish-block is-dark",
            x: (col - 1) * blockW,
            y: -tickSize + row * blockH,
            width: blockW,
            height: blockH,
          })
        );
      }
    }

    svg.appendChild(finishLine);
  }

  function renderTrack(track: TrackData): boolean {
    if (!track || !track.route || !hasValidField(track.field)) {
      showMessage("No ready TrackDraw route.");
      return false;
    }
    if (!track.readiness || track.readiness.status !== "ready") {
      showMessage("TrackDraw setup is blocked.");
      return false;
    }

    const field = track.field;
    const points = (
      track.route.sampled_points ??
      track.route.waypoints ??
      []
    ).filter(hasPoint) as Point[];

    if (points.length <= 1) {
      showMessage("Route has no drawable points.");
      return false;
    }

    fieldScale = Math.sqrt(field.width * field.width + field.height * field.height);

    const minDim = Math.min(window.innerWidth || 1920, window.innerHeight || 1080);
    visualScale =
      minDim < 300 ? 2.8
      : minDim < 420 ? 2.2
      : minDim < 600 ? 1.7
      : minDim < 900 ? 1.3
      : 1.0;

    const vs = visualScale;
    const vsT = Math.min(vs, 1.5);
    const routeShadowW = fieldScale * 0.016 * vs;
    const routeOuterW = fieldScale * 0.010 * vs;
    const routeInnerW = fieldScale * 0.006 * vs;
    const gateR = fieldScale * 0.006 * vs;
    const gateCoreR = fieldScale * 0.0027 * vs;
    const gateSwW = fieldScale * 0.0017 * vs;
    const timingSfR = fieldScale * 0.013 * vsT;
    const timingR = fieldScale * 0.010 * vsT;
    const timingSwW = fieldScale * 0.003 * vsT;

    clearSvg();
    setSafeViewBox(svgEl, field, points, track, fieldScale);

    const routeD = getRoutePath(field, points);
    for (const [cls, sw] of [
      ["trackdraw-map__route-shadow", routeShadowW],
      ["trackdraw-map__route-outline", routeOuterW],
      ["trackdraw-map__route", routeInnerW],
    ] as Array<[string, number]>) {
      const routeLayerPath = createSvgElement("path", { class: cls, d: routeD });
      routeLayerPath.style.strokeWidth = String(sw);
      svgEl.appendChild(routeLayerPath);
    }

    for (const obstacle of track.route_obstacles ?? []) {
      if (!obstacle.route_position || typeof obstacle.route_position.progress !== "number") continue;
      const gatePoint = getVisualPoint(field, obstacle, obstacle.route_position);
      if (!gatePoint) continue;
      const gate = createSvgElement("g", {
        class: "trackdraw-map__gate",
        transform: "translate(" + gatePoint.x + " " + gatePoint.y + ")",
      });
      const marker = createSvgElement("circle", {
        class: "trackdraw-map__gate-marker",
        r: gateR,
      });
      marker.style.strokeWidth = String(gateSwW);
      const core = createSvgElement("circle", {
        class: "trackdraw-map__gate-marker-core",
        r: gateCoreR,
      });
      gate.appendChild(marker);
      gate.appendChild(core);
      svgEl.appendChild(gate);
    }

    for (const marker of track.timing_markers ?? []) {
      if (!marker.route_position) continue;
      const pt = getVisualPoint(field, marker, marker.route_position);
      if (!pt) continue;
      const isStartFinish = marker.role === "start_finish";
      const r = isStartFinish ? timingSfR : timingR;
      const routePoint = progressToPointWithAngle(sampledPoints, field, marker.route_position.progress);
      const angle = routePoint ? routePoint.angle : 0;
      const normal = angle + Math.PI / 2;
      const tickSize = isStartFinish ? r * 2.8 : r * 2.1;

      const tick = createSvgElement("line", {
        class: isStartFinish
          ? "trackdraw-map__timing-tick is-start-finish"
          : "trackdraw-map__timing-tick is-split",
        x1: pt.x - Math.cos(normal) * tickSize,
        y1: pt.y - Math.sin(normal) * tickSize,
        x2: pt.x + Math.cos(normal) * tickSize,
        y2: pt.y + Math.sin(normal) * tickSize,
      });
      tick.style.strokeWidth = String(isStartFinish ? timingSwW * 2 : timingSwW);
      svgEl.appendChild(tick);

      if (isStartFinish) {
        renderFinishLine(svgEl, pt, angle, r);
      }
    }

    pilotGroupEl = createSvgElement("g", { class: "trackdraw-map__pilots" });
    svgEl.appendChild(pilotGroupEl);

    hideMessage();
    return true;
  }

  // ---- Pilot rendering ----

  function getPilotLabel(pilot: PilotState): string {
    return (pilot.callsign || "N" + (pilot.nodeIndex + 1)).slice(0, 4).toUpperCase();
  }

  function getLabelSlot(pilot: PilotState): number {
    const index = Number(pilot.nodeIndex);
    return isNaN(index) ? 0 : Math.abs(index) % LABEL_DIRECTIONS.length;
  }

  function getLabelOffset(slot: number): Point {
    const direction = LABEL_DIRECTIONS[slot] ?? LABEL_DIRECTIONS[0];
    const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y) || 1;
    const radius = fieldScale * 0.044 * visualScale;
    return {
      x: (direction.x / length) * radius,
      y: (direction.y / length) * radius,
    };
  }

  function ensurePilotEl(pilot: PilotState): SVGGElement | null {
    const id = "td-pilot-" + pilot.nodeIndex;
    const existing = document.getElementById(id);
    if (existing instanceof SVGGElement) {
      if (!pilotElsMap.has(existing)) {
        pilotElsMap.set(existing, {
          halo: existing.querySelector(".trackdraw-map__pilot-halo") as SVGCircleElement,
          marker: existing.querySelector(".trackdraw-map__pilot-marker") as SVGGElement,
          arrow: existing.querySelector(".trackdraw-map__pilot") as SVGPolygonElement,
          callsignBg: existing.querySelector(".trackdraw-map__pilot-callsign-bg") as SVGPathElement,
          callsignText: existing.querySelector(".trackdraw-map__pilot-callsign") as SVGTextElement,
        });
      }
      return existing;
    }
    if (!pilotGroupEl) return null;

    const g = createSvgElement("g", { id, class: "trackdraw-map__pilot-group" });
    pilot._frameClass = null;
    pilot._frameTransform = null;
    pilot._frameColor = null;
    pilot._markerTransform = null;
    pilot._labelLayoutKey = null;

    const vs = visualScale;
    const pilotR = fieldScale * 0.010 * vs;
    const halo = createSvgElement("circle", {
      class: "trackdraw-map__pilot-halo",
      r: pilotR * 1.9,
    });
    halo.style.strokeWidth = String(fieldScale * 0.0032 * vs);

    const marker = createSvgElement("g", { class: "trackdraw-map__pilot-marker" });
    const arrowLen = fieldScale * 0.019 * vs;
    const arrowW = fieldScale * 0.009 * vs;
    const arrow = createSvgElement("polygon", {
      class: "trackdraw-map__pilot",
      points: [
        arrowLen + ",0",
        -arrowLen * 0.58 + "," + -arrowW,
        -arrowLen * 0.22 + ",0",
        -arrowLen * 0.58 + "," + arrowW,
      ].join(" "),
    });
    arrow.style.fill = pilot.color;
    arrow.style.strokeWidth = String(fieldScale * 0.0023 * vs);
    marker.appendChild(arrow);

    const callsignBg = createSvgElement("path", { class: "trackdraw-map__pilot-callsign-bg" });
    const callsignText = createSvgElement("text", { class: "trackdraw-map__pilot-callsign" });
    callsignText.style.fontSize = fieldScale * 0.0158 * vs + "px";
    callsignText.textContent = getPilotLabel(pilot);

    g.appendChild(halo);
    g.appendChild(marker);
    g.appendChild(callsignBg);
    g.appendChild(callsignText);

    pilotElsMap.set(g, {
      halo,
      marker,
      arrow,
      callsignBg,
      callsignText,
    });

    pilotGroupEl.appendChild(g);
    return g;
  }

  function clearPilotEls(): void {
    if (!pilotGroupEl) return;
    while (pilotGroupEl.firstChild) pilotGroupEl.removeChild(pilotGroupEl.firstChild);
  }

  // ---- Animation loop ----

  function animationTick(): void {
    if (destroyed) return;

    if (svgEl && pilotGroupEl) {
      const activeNodeIndexes = Object.keys(pilots).filter(
        (nodeIdx) => pilots[nodeIdx] && pilots[nodeIdx].active
      );
      updatePilotDensityClass(activeNodeIndexes.length);

      for (const nodeIdx of activeNodeIndexes) {
        const pilot = pilots[nodeIdx];

        const g = ensurePilotEl(pilot);
        if (!g) continue;
        const els = pilotElsMap.get(g);
        if (!els) continue;

        const progress = estimateProgress(pilot, raceRunning, socketConnected, getBaselineLapMs(), anchorModel);
        const routePoint = trackData
          ? progressToPointWithAngle(sampledPoints, trackData.field, progress)
          : null;
        if (!routePoint) continue;
        const pt: Point = { x: routePoint.x, y: routePoint.y };

        const labelSlot = getLabelSlot(pilot);
        const labelOffset = getLabelOffset(labelSlot);

        const position = Number(pilot.position);
        const hasPosition = !isNaN(position) && position > 0;
        const confidence = getPilotConfidence(pilot, raceRunning, socketConnected, getBaselineLapMs());
        const isLeader = position === 1;
        const hideLabel =
          activeNodeIndexes.length >= 7 &&
          !isLeader &&
          (!hasPosition || position > 4);

        let groupClass = "trackdraw-map__pilot-group is-" + confidence;
        if (isLeader) groupClass += " is-leader";
        if (isPilotCorrecting(pilot)) groupClass += " is-correcting";
        if (hideLabel) groupClass += " is-label-hidden";

        if (pilot._frameClass !== groupClass) {
          g.setAttribute("class", groupClass);
          pilot._frameClass = groupClass;
        }
        const groupTransform = "translate(" + pt.x + " " + pt.y + ")";
        if (pilot._frameTransform !== groupTransform) {
          g.setAttribute("transform", groupTransform);
          pilot._frameTransform = groupTransform;
        }
        if (isLeader && g.parentNode === pilotGroupEl && g !== pilotGroupEl.lastChild) {
          pilotGroupEl.appendChild(g);
        }

        const label = getPilotLabel(pilot);

        if (pilot._frameColor !== pilot.color) {
          if (els.halo) els.halo.style.stroke = pilot.color;
          if (els.arrow) els.arrow.style.fill = pilot.color;
          pilot._frameColor = pilot.color;
        }
        if (els.marker) {
          const markerTransform = "rotate(" + (routePoint.angle * 180) / Math.PI + ")";
          if (pilot._markerTransform !== markerTransform) {
            els.marker.setAttribute("transform", markerTransform);
            pilot._markerTransform = markerTransform;
          }
        }

        const labelLayoutKey = [labelSlot, label, pilot.color].join("|");
        if (pilot._labelLayoutKey !== labelLayoutKey) {
          const vs = visualScale;
          const labelW = fieldScale * 0.064 * vs;
          const labelH = fieldScale * 0.022 * vs;
          const r = labelH * 0.40;
          const labelX = labelOffset.x - labelW / 2;
          const labelY = labelOffset.y - labelH / 2;
          const cy = labelOffset.y + fieldScale * 0.005 * vs;

          if (els.callsignBg) {
            let bgd: string;
            if (theme === "lcdr") {
              bgd = roundedRectPath(labelX, labelY, labelW, labelH, 0, 0, 0, 0);
              els.callsignBg.style.fill = pilot.color;
              els.callsignBg.style.stroke = "none";
            } else if (theme === "apex") {
              bgd = roundedRectPath(labelX, labelY, labelW, labelH, r, r, r, r);
              els.callsignBg.style.fill = "var(--trackdraw-pilot-label-bg, rgb(0 0 0 / 88%))";
              els.callsignBg.style.stroke = pilot.color;
              els.callsignBg.style.strokeWidth = String(fieldScale * 0.003 * vs);
            } else {
              bgd = roundedRectPath(labelX, labelY, labelW, labelH, r, 0, r, 0);
              els.callsignBg.style.fill = pilot.color;
              els.callsignBg.style.stroke = "none";
            }
            els.callsignBg.setAttribute("d", bgd);
          }
          if (els.callsignText) {
            els.callsignText.setAttribute("x", String(labelX + labelW / 2));
            els.callsignText.setAttribute("y", String(cy));
            els.callsignText.setAttribute("text-anchor", "middle");
            els.callsignText.style.fill =
              theme === "apex"
                ? "var(--trackdraw-text, #fff)"
                : getContrastColor(pilot.color);
            els.callsignText.textContent = label;
          }

          pilot._labelLayoutKey = labelLayoutKey;
        }
      }
    }

    animationFrameId = window.requestAnimationFrame(animationTick);
  }

  // ---- Socket event handlers ----

  function onHeat(heatNodes: Record<string, HeatNode>): void {
    pilots = {};
    prevLapCounts = {};
    prevSplitCounts = {};
    clearPilotEls();

    for (const key of Object.keys(heatNodes)) {
      const index = parseInt(key, 10);
      const node = heatNodes[key];
      if (!node || !node.callsign) continue;

      pilots[String(index)] = createPilot(
        index,
        String(node.callsign),
        toHexColor(node.activeColor),
        anchorModel,
        getBaselineLapMs()
      );
    }
  }

  function onRaceStatus(status: number): void {
    const wasRunning = raceRunning;
    raceRunning = status === 1;

    if (status === 1 && !wasRunning) {
      const startNext = getNextAnchor(anchorModel, anchorModel.startFinishProgress);
      for (const nodeIdx of Object.keys(pilots)) {
        const pilot = pilots[nodeIdx];
        pilot.lastAnchorProgress = anchorModel.startFinishProgress;
        pilot.lastAnchorKey = anchorModel.startFinishKey;
        pilot.nextAnchorProgress = startNext.progress;
        pilot.nextAnchorKey = startNext.key;
        pilot.expectedSegmentMs = getExpectedSegmentMs(
          pilot,
          pilot.lastAnchorProgress,
          pilot.nextAnchorProgress,
          pilot.lastAnchorKey,
          pilot.nextAnchorKey,
          anchorModel,
          baselineLapMs
        );
        pilot.lastAnchorTime = null;
        pilot.lastTimingAt = null;
        pilot.confidence = "idle";
        pilot.correctionStartTime = null;
        pilot.correctionEndTime = null;
      }
      prevLapCounts = {};
      prevSplitCounts = {};
    }

    if (status === 0 || status === 2) {
      freezePilots(pilots, "idle", anchorModel, raceRunning, getBaselineLapMs());
    }
  }

  function onConnect(): void {
    socketConnected = true;
    if (trackData === null && !trackLoadPending) {
      renderer.loadTrack();
    } else {
      for (const k of Object.keys(pilots)) {
        pilots[k].confidence = "idle";
      }
    }
  }

  function onDisconnect(): void {
    socketConnected = false;
    freezePilots(pilots, "stale", anchorModel, raceRunning, getBaselineLapMs());
  }

  function onCurrentLaps(nodeIndex: Record<string, unknown>): void {
    for (const nodeIdx of Object.keys(nodeIndex)) {
      const nodeData = nodeIndex[nodeIdx];
      const pilot = pilots[nodeIdx];
      if (!pilot || !nodeData || typeof nodeData !== "object") continue;

      const nd = nodeData as Record<string, unknown>;
      if (!Array.isArray(nd.laps)) continue;

      const laps = getActiveLaps(nd.laps as unknown[]);
      const prevCount = prevLapCounts[nodeIdx] ?? 0;
      const minLapMs = getConfiguredMinLapMs();

      if (laps.length > prevCount) {
        learnLapSamples(pilot, laps, prevCount, minLapMs);
        const latest = laps[laps.length - 1];
        const lapNumber = Number(latest.lap_number);

        if (lapNumber === 0) {
          setPilotAnchor(
            pilot,
            anchorModel.startFinishProgress,
            {
              anchorKey: anchorModel.startFinishKey,
              confidence: pilot.hasLearnedPace ? "high" : "low",
            },
            anchorModel,
            raceRunning,
            socketConnected,
            getBaselineLapMs()
          );
        } else if (lapNumber > 0) {
          setPilotAnchor(
            pilot,
            anchorModel.startFinishProgress,
            {
              anchorKey: anchorModel.startFinishKey,
              confidence: "high",
            },
            anchorModel,
            raceRunning,
            socketConnected,
            getBaselineLapMs()
          );
          pilot.lapCount = lapNumber;
        }
      }

      // Process new splits
      if (laps.length > 0 && Object.keys(splitProgressMap).length > 0) {
        const lapIdx = laps.length - 1;
        const currentLap = laps[lapIdx];
        const splits = Array.isArray(currentLap.splits) ? (currentLap.splits as Record<string, unknown>[]) : [];
        const splitKey = nodeIdx + ":" + lapIdx;
        const prevSplitCount = prevSplitCounts[splitKey] ?? 0;

        for (let i = prevSplitCount; i < splits.length; i++) {
          const split = splits[i];
          const splitId = Number(split.split_id);
          const splitProgress = splitProgressMap[splitId];
          if (typeof splitProgress === "number") {
            setPilotAnchor(
              pilot,
              splitProgress,
              { anchorKey: "split:" + splitId, confidence: "high" },
              anchorModel,
              raceRunning,
              socketConnected,
              getBaselineLapMs()
            );
          }
        }
        prevSplitCounts[splitKey] = splits.length;
      }

      prevLapCounts[nodeIdx] = laps.length;
    }
  }

  function onLeaderboard(
    entries: Array<{ node?: number | null; position?: number | null; callsign?: string | null }>
  ): void {
    for (const entry of entries) {
      if (!entry || entry.node == null) continue;
      const pilot = pilots[String(entry.node)];
      if (!pilot) continue;
      if (entry.position != null) pilot.position = entry.position;
      if (entry.callsign) pilot.callsign = entry.callsign;
    }
  }

  // ---- Resize ----

  function onResize(): void {
    applyViewportClass();
    if (svgEl && trackData && sampledPoints.length) {
      setSafeViewBox(svgEl, trackData.field, sampledPoints, trackData, fieldScale);
    }
  }

  const resizeListener = () => onResize();

  // ---- Load ----

  function loadTrack(): void {
    if (trackLoadPending) return;
    trackLoadPending = true;
    const url = getTrackJsonUrl();
    showMessage("Loading TrackDraw map...");

    fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status + " from " + url);
        return r.json() as Promise<unknown>;
      })
      .then((payload) => {
        trackLoadPending = false;
        if (destroyed) return;

        const data = payload as Record<string, unknown>;
        if (!data.ok || !data.track) {
          showMessage(getReadinessMessage(data));
          return;
        }

        trackData = data.track as TrackData;
        setBaselineLapMs(trackData);
        sampledPoints = (
          (trackData.route?.sampled_points ?? trackData.route?.waypoints) ?? []
        ).filter(hasPoint) as Point[];

        const model = buildTrackModel(trackData.timing_markers);
        splitProgressMap = model.splitProgressMap;
        anchorModel = model.anchorModel;

        if (!renderTrack(trackData)) return;

        if (!animationRunning) {
          animationRunning = true;
          animationFrameId = window.requestAnimationFrame(animationTick);
        }
      })
      .catch((err: unknown) => {
        trackLoadPending = false;
        if (destroyed) return;
        showMessage(
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Could not load TrackDraw cache."
        );
      });
  }

  // ---- Destroy ----

  function destroy(): void {
    destroyed = true;
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    window.removeEventListener("resize", resizeListener);
    unsubscribeStore();
  }

  // ---- Init ----
  applyViewportClass();

  // ?labels=0 hides all pilot callsign labels
  const params = new URLSearchParams(window.location.search);
  if (params.get("labels") === "0") {
    const root = getRoot();
    if (root) root.classList.add("is-labels-off");
  }

  window.addEventListener("resize", resizeListener);

  const renderer: TrackDrawRenderer = {
    loadTrack,
    onConnect,
    onDisconnect,
    onHeat,
    onRaceStatus,
    onCurrentLaps,
    onLeaderboard,
    onResize,
    destroy,
  };

  return renderer;
}
