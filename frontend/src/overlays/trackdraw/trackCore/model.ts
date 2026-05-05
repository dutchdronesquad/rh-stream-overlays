import type {
  AnchorModel,
  AnchorPoint,
  PilotState,
  TimingMarker,
  TrackData,
  TrackModel,
} from "./types";
import {
  forwardDelta,
  normalizeProgress,
  progressDistance,
} from "./geometry";
import { getSegmentShare } from "./progress";

const MIN_OBSERVED_SEGMENT_MS = 600;
const EMA_ALPHA = 0.35;

// ---------------------------------------------------------------------------
// Track model
// ---------------------------------------------------------------------------

export function buildTrackModel(timingMarkers: TimingMarker[] | undefined): TrackModel {
  const localSplitMap: Record<number, number> = {};
  let startFinishProgress = 0;
  const splits: AnchorPoint[] = [];

  for (const marker of timingMarkers ?? []) {
    if (!marker?.route_position || typeof marker.route_position.progress !== "number") {
      continue;
    }
    const progress = normalizeProgress(marker.route_position.progress);

    if (marker.role === "start_finish") {
      startFinishProgress = progress;
    } else if (
      marker.role === "split" &&
      typeof marker.split_index === "number" &&
      !isNaN(marker.split_index)
    ) {
      localSplitMap[marker.split_index] = progress;
      splits.push({
        key: "split:" + marker.split_index,
        splitIndex: marker.split_index,
        progress,
        title: marker.title ?? "Split " + (marker.split_index + 1),
      });
    }
  }

  splits.sort(
    (a, b) =>
      forwardDelta(startFinishProgress, a.progress) -
      forwardDelta(startFinishProgress, b.progress)
  );

  return {
    splitProgressMap: localSplitMap,
    anchorModel: {
      startFinishProgress,
      startFinishKey: "sf",
      orderedSplits: splits,
    },
  };
}

// ---------------------------------------------------------------------------
// Anchor queries
// ---------------------------------------------------------------------------

export function getNextAnchor(anchorModel: AnchorModel, progress: number): AnchorPoint {
  const current = normalizeProgress(progress);
  const splits = anchorModel.orderedSplits;
  let nextSplit: AnchorPoint | null = null;
  let nextDistance = 1;

  for (const split of splits) {
    const distance = forwardDelta(current, split.progress);
    if (distance > 0.0001 && distance < nextDistance) {
      nextDistance = distance;
      nextSplit = split;
    }
  }

  if (nextSplit) return nextSplit;
  return {
    key: anchorModel.startFinishKey,
    progress: anchorModel.startFinishProgress,
  };
}

export function getAnchorKeyForProgress(
  anchorModel: AnchorModel,
  progress: number
): string {
  const normalized = normalizeProgress(progress);
  let bestKey = anchorModel.startFinishKey;
  let bestDistance = progressDistance(anchorModel.startFinishProgress, normalized);

  for (const split of anchorModel.orderedSplits) {
    const distance = progressDistance(split.progress, normalized);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestKey = split.key;
    }
  }

  return bestKey;
}

export function getSegmentKey(fromKey: string, toKey: string): string {
  return String(fromKey || "unknown") + ">" + String(toKey || "unknown");
}

// ---------------------------------------------------------------------------
// Segment timing EMA
// ---------------------------------------------------------------------------

export function updateExpectedSegmentMs(
  pilot: PilotState,
  fromKey: string,
  toKey: string,
  segmentMs: number
): void {
  if (!fromKey || !toKey || !Number.isFinite(segmentMs) || segmentMs < MIN_OBSERVED_SEGMENT_MS) {
    return;
  }
  const key = getSegmentKey(fromKey, toKey);
  const current = pilot.expectedSegmentMsByKey[key];
  pilot.expectedSegmentMsByKey[key] =
    typeof current === "number"
      ? Math.round(EMA_ALPHA * segmentMs + (1 - EMA_ALPHA) * current)
      : Math.round(segmentMs);
}

export function getExpectedSegmentMs(
  pilot: PilotState,
  fromProgress: number,
  toProgress: number,
  fromKey: string,
  toKey: string,
  anchorModel: AnchorModel,
  baselineLapMs: number
): number {
  const segmentKey = getSegmentKey(fromKey, toKey);
  const segmentMs = pilot.expectedSegmentMsByKey[segmentKey];
  if (typeof segmentMs === "number" && segmentMs > 0) {
    return segmentMs;
  }
  const lapMs = pilot.expectedLapMs || baselineLapMs;
  const share = getSegmentShare(fromProgress, toProgress, fromKey, toKey, anchorModel);
  return Math.max(1200, Math.round(lapMs * share));
}

// ---------------------------------------------------------------------------
// Track-level helpers
// ---------------------------------------------------------------------------

export function getValidDurationEstimateMs(track: TrackData): number | null {
  const estimate = track.duration_estimate;
  const value = estimate?.estimated_lap_ms;
  if (typeof value !== "number" || !isFinite(value) || value <= 0) return null;
  return Math.round(value);
}
