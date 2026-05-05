import type { Point, PointWithAngle, AnchorModel } from "./types";
import {
  clamp01,
  normalizeProgress,
  forwardDelta,
  getPoint,
} from "./geometry";
import type { TrackField } from "./types";

// ---------------------------------------------------------------------------
// Point interpolation along the sampled route
// ---------------------------------------------------------------------------

export function progressToPoint(
  sampledPoints: Point[],
  field: TrackField,
  progress: number
): Point | null {
  if (!sampledPoints.length) return null;
  const normalized = normalizeProgress(progress);
  const idx = normalized * (sampledPoints.length - 1);
  const i = Math.floor(idx);
  const t = idx - i;
  if (i >= sampledPoints.length - 1) {
    return getPoint(field, sampledPoints[sampledPoints.length - 1]);
  }
  const a = sampledPoints[i];
  const b = sampledPoints[i + 1];
  return getPoint(field, {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  });
}

export function progressToPointWithAngle(
  sampledPoints: Point[],
  field: TrackField,
  progress: number
): PointWithAngle | null {
  const point = progressToPoint(sampledPoints, field, progress);
  if (!point || sampledPoints.length < 2) return null;

  const tangentDelta = Math.max(0.003, 1 / (sampledPoints.length - 1));
  const a = progressToPoint(sampledPoints, field, progress - tangentDelta);
  const b = progressToPoint(sampledPoints, field, progress + tangentDelta);
  const angle = a && b ? Math.atan2(b.y - a.y, b.x - a.x) : 0;

  return { x: point.x, y: point.y, angle };
}

// ---------------------------------------------------------------------------
// Segment share helpers
// ---------------------------------------------------------------------------

function isFullLapSegment(fromKey: string, toKey: string, anchorModel: AnchorModel): boolean {
  return fromKey === anchorModel.startFinishKey && toKey === anchorModel.startFinishKey;
}

export function getSegmentShare(
  fromProgress: number,
  toProgress: number,
  fromKey: string,
  toKey: string,
  anchorModel: AnchorModel
): number {
  if (isFullLapSegment(fromKey, toKey, anchorModel)) return 1;
  return forwardDelta(fromProgress, toProgress);
}

export function interpolateProgress(
  fromProgress: number,
  toProgress: number,
  ratio: number,
  fromKey: string,
  toKey: string,
  anchorModel: AnchorModel
): number {
  const distance = getSegmentShare(fromProgress, toProgress, fromKey, toKey, anchorModel);
  return normalizeProgress(
    normalizeProgress(fromProgress) + distance * clamp01(ratio)
  );
}
