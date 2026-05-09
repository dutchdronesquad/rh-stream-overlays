import type { AnchorModel, PilotState } from "./types";
import {
  clamp01,
  forwardDelta,
  normalizeProgress,
  progressDistance,
} from "./geometry";
import {
  getAnchorKeyForProgress,
  getNextAnchor,
  getSegmentKey,
  updateExpectedSegmentMs,
  getExpectedSegmentMs,
} from "./model";
import { interpolateProgress, getSegmentShare } from "./progress";

const EMA_ALPHA = 0.35;
const ANCHOR_CORRECTION_MS = 650;
const CONFIDENCE_HIGH_MS = 2500;
const STALE_WINDOW_MS = 8000;
const LAP_ROLLOVER_CONTINUITY_PROGRESS = 0.18;
const CORRECTION_FADE_THRESHOLD_PROGRESS = 0.025;
const MIN_SEGMENT_MS = 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getConfiguredMinLapMs(): number | null {
  type RHGlobal = { min_lap?: number };
  const rh = (globalThis as { rotorhazard?: RHGlobal }).rotorhazard;
  return typeof rh?.min_lap === "number" && rh.min_lap > 0 ? rh.min_lap * 1000 : null;
}

function getStaleWindowMs(): number {
  return getConfiguredMinLapMs() ?? STALE_WINDOW_MS;
}

function getEffectiveSegmentMs(pilot: PilotState, baselineLapMs: number): number {
  const segmentMs = pilot.expectedSegmentMs || pilot.expectedLapMs || baselineLapMs;
  return Number.isFinite(segmentMs) && segmentMs > 0
    ? Math.max(segmentMs, MIN_SEGMENT_MS)
    : MIN_SEGMENT_MS;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPilot(
  nodeIndex: number,
  callsign: string,
  color: string,
  anchorModel: AnchorModel,
  baselineLapMs: number
): PilotState {
  const startNext = getNextAnchor(anchorModel, anchorModel.startFinishProgress);
  return {
    nodeIndex,
    callsign,
    color,
    active: true,
    lapCount: 0,
    position: null,
    lastAnchorProgress: anchorModel.startFinishProgress,
    lastAnchorKey: anchorModel.startFinishKey,
    nextAnchorProgress: startNext.progress,
    nextAnchorKey: startNext.key,
    lastAnchorTime: null,
    lastTimingAt: null,
    expectedSegmentMs: baselineLapMs,
    expectedSegmentMsByKey: {},
    expectedLapMs: baselineLapMs,
    hasLearnedPace: false,
    confidence: "idle",
    lastSeenAt: null,
    correctionStartTime: null,
    correctionEndTime: null,
    _frameClass: null,
    _frameTransform: null,
    _frameColor: null,
    _markerTransform: null,
    _labelLayoutKey: null,
  };
}

// ---------------------------------------------------------------------------
// Anchor placement
// ---------------------------------------------------------------------------

export type SetPilotAnchorOptions = {
  anchorKey?: string;
  easeMs?: number;
  ease?: boolean;
  rollover?: boolean;
  freeze?: boolean;
  confidence?: string;
};

export function setPilotAnchor(
  pilot: PilotState,
  progress: number,
  options: SetPilotAnchorOptions,
  anchorModel: AnchorModel,
  raceRunning: boolean,
  socketConnected: boolean,
  baselineLapMs: number
): void {
  const opts = options;
  const now = window.performance.now();
  const normalized = normalizeProgress(progress);
  const anchorKey = opts.anchorKey ?? getAnchorKeyForProgress(anchorModel, normalized);
  const currentProgress = getCurrentPilotProgress(pilot, raceRunning, baselineLapMs, anchorModel);
  const currentAnchorKey = pilot.lastAnchorKey || getAnchorKeyForProgress(anchorModel, pilot.lastAnchorProgress);
  const correctionMs = opts.easeMs ?? ANCHOR_CORRECTION_MS;
  const nextAnchor = getNextAnchor(anchorModel, normalized);
  const segmentMs = getExpectedSegmentMs(
    pilot,
    normalized,
    nextAnchor.progress,
    anchorKey,
    nextAnchor.key,
    anchorModel,
    baselineLapMs
  );
  let carriedElapsedMs: number | null = null;
  const segmentShare = getSegmentShare(normalized, nextAnchor.progress, anchorKey, nextAnchor.key, anchorModel);
  const progressFromAnchor = forwardDelta(normalized, currentProgress);

  if (opts.rollover === true && segmentShare > 0) {
    const continuityThreshold = Math.min(LAP_ROLLOVER_CONTINUITY_PROGRESS, segmentShare * 0.6);
    let progressPastAnchor: number | null = null;
    if (progressFromAnchor > 0 && progressFromAnchor <= continuityThreshold) {
      progressPastAnchor = progressFromAnchor;
    } else if (progressFromAnchor >= 1 - continuityThreshold) {
      progressPastAnchor = 1 - progressFromAnchor;
    }
    if (progressPastAnchor !== null) {
      carriedElapsedMs = Math.round(segmentMs * (progressPastAnchor / segmentShare));
    }
  }

  const pilotIsApproaching = progressFromAnchor >= 1 - LAP_ROLLOVER_CONTINUITY_PROGRESS;
  const shouldFadeCorrection =
    !opts.rollover &&
    !pilotIsApproaching &&
    carriedElapsedMs === null &&
    opts.ease !== false &&
    !opts.freeze &&
    raceRunning &&
    socketConnected &&
    pilot.lastAnchorTime !== null &&
    progressDistance(currentProgress, normalized) > CORRECTION_FADE_THRESHOLD_PROGRESS;

  if (pilot.lastTimingAt !== null && currentAnchorKey !== anchorKey) {
    updateExpectedSegmentMs(pilot, currentAnchorKey, anchorKey, now - pilot.lastTimingAt);
  }

  pilot.lastAnchorProgress = normalized;
  pilot.lastAnchorKey = anchorKey;
  pilot.nextAnchorProgress = nextAnchor.progress;
  pilot.nextAnchorKey = nextAnchor.key;
  pilot.expectedSegmentMs = segmentMs;
  pilot.lastAnchorTime = opts.freeze
    ? null
    : now +
      (shouldFadeCorrection ? correctionMs : 0) -
      (carriedElapsedMs === null ? 0 : carriedElapsedMs);
  pilot.confidence = opts.confidence ?? "high";
  pilot.lastSeenAt = now;
  pilot.lastTimingAt = now;
  pilot.correctionStartTime = shouldFadeCorrection ? now : null;
  pilot.correctionEndTime = shouldFadeCorrection ? now + correctionMs : null;
}

// ---------------------------------------------------------------------------
// Progress estimation
// ---------------------------------------------------------------------------

export function getCurrentPilotProgress(
  pilot: PilotState,
  raceRunning: boolean,
  baselineLapMs: number,
  anchorModel: AnchorModel
): number {
  const now = window.performance.now();
  if (pilot.lastAnchorTime === null || !raceRunning) {
    return pilot.lastAnchorProgress;
  }
  if (now < pilot.lastAnchorTime) {
    return pilot.lastAnchorProgress;
  }
  const elapsed = now - pilot.lastAnchorTime;
  const segmentMs = getEffectiveSegmentMs(pilot, baselineLapMs);
  const ratio = elapsed / segmentMs;

  if (ratio <= 1.0) {
    return interpolateProgress(
      pilot.lastAnchorProgress,
      pilot.nextAnchorProgress,
      ratio,
      pilot.lastAnchorKey,
      pilot.nextAnchorKey,
      anchorModel
    );
  }
  const segmentEnd = normalizeProgress(pilot.nextAnchorProgress);
  const overProgress = (elapsed - segmentMs) / segmentMs;
  return normalizeProgress(segmentEnd + overProgress);
}

export function estimateProgress(
  pilot: PilotState,
  raceRunning: boolean,
  socketConnected: boolean,
  baselineLapMs: number,
  anchorModel: AnchorModel
): number {
  if (pilot.lastAnchorTime === null || !raceRunning || !socketConnected) {
    return pilot.lastAnchorProgress;
  }
  return getCurrentPilotProgress(pilot, raceRunning, baselineLapMs, anchorModel);
}

// ---------------------------------------------------------------------------
// Confidence / staleness
// ---------------------------------------------------------------------------

export function isPilotStale(
  pilot: PilotState,
  raceRunning: boolean,
  baselineLapMs: number
): boolean {
  if (pilot.lastAnchorTime === null || !raceRunning) return false;
  const elapsed = window.performance.now() - pilot.lastAnchorTime;
  const segmentMs = getEffectiveSegmentMs(pilot, baselineLapMs);
  return elapsed > segmentMs + getStaleWindowMs();
}

export function isPilotCorrecting(pilot: PilotState): boolean {
  const now = window.performance.now();
  return (
    pilot.correctionStartTime !== null &&
    pilot.correctionEndTime !== null &&
    now < pilot.correctionEndTime
  );
}

export function getPilotConfidence(
  pilot: PilotState,
  raceRunning: boolean,
  socketConnected: boolean,
  baselineLapMs: number
): string {
  if (!socketConnected && raceRunning) return "stale";
  if (isPilotStale(pilot, raceRunning, baselineLapMs)) return "stale";
  if (!raceRunning || pilot.lastAnchorTime === null) return "idle";
  if (pilot.confidence === "low") return "low";

  const elapsed = window.performance.now() - pilot.lastAnchorTime;
  const segmentMs = getEffectiveSegmentMs(pilot, baselineLapMs);
  if (elapsed < CONFIDENCE_HIGH_MS) return "high";
  if (elapsed > segmentMs * 0.85) return "low";
  return "medium";
}

// ---------------------------------------------------------------------------
// Freeze
// ---------------------------------------------------------------------------

export function freezePilots(
  pilots: Record<string, PilotState>,
  confidence: string,
  anchorModel: AnchorModel,
  raceRunning: boolean,
  baselineLapMs: number
): void {
  for (const nodeIdx of Object.keys(pilots)) {
    const pilot = pilots[nodeIdx];
    const progress = getCurrentPilotProgress(pilot, raceRunning, baselineLapMs, anchorModel);
    const next = getNextAnchor(anchorModel, progress);
    pilot.lastAnchorProgress = progress;
    pilot.lastAnchorKey = getAnchorKeyForProgress(anchorModel, progress);
    pilot.nextAnchorProgress = next.progress;
    pilot.nextAnchorKey = next.key;
    pilot.lastAnchorTime = null;
    pilot.confidence = confidence;
    pilot.correctionStartTime = null;
    pilot.correctionEndTime = null;
  }
}

// ---------------------------------------------------------------------------
// Lap time learning
// ---------------------------------------------------------------------------

export function getLapTimeMs(lap: Record<string, unknown>): number | null {
  if (!lap) return null;
  if (lap.deleted === true) return null;
  return parseLapTime(lap.lap_time) ?? parseLapTime(lap.lap_raw);
}

function parseLapTime(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

export function getActiveLaps(laps: unknown[]): Record<string, unknown>[] {
  if (!Array.isArray(laps)) return [];
  return laps.filter(
    (lap): lap is Record<string, unknown> =>
      lap !== null && typeof lap === "object" && (lap as Record<string, unknown>).deleted !== true
  );
}

export function updateExpectedLapMs(
  pilot: PilotState,
  lapMs: number | null,
  minLapMs: number | null
): void {
  if (typeof lapMs !== "number" || lapMs <= 0) return;
  if (minLapMs !== null && lapMs < minLapMs) return;

  if (pilot.hasLearnedPace !== true) {
    pilot.expectedLapMs = lapMs;
  } else {
    pilot.expectedLapMs = Math.round(EMA_ALPHA * lapMs + (1 - EMA_ALPHA) * pilot.expectedLapMs);
  }
  pilot.hasLearnedPace = true;
}

export function learnLapSamples(
  pilot: PilotState,
  laps: Record<string, unknown>[],
  startIndex: number,
  minLapMs: number | null
): void {
  for (let i = startIndex; i < laps.length; i++) {
    const lapNumber = Number(laps[i].lap_number);
    if (lapNumber > 0) {
      updateExpectedLapMs(pilot, getLapTimeMs(laps[i]), minLapMs);
    }
  }
}

// Unused export kept for type completeness
export { clamp01, getSegmentKey };
