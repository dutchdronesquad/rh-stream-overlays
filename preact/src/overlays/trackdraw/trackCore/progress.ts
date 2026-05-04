export type TrackDrawTimingMarker = {
  role?: string;
  route_position?: {
    progress?: number;
  };
  split_index?: number;
  title?: string;
};

export type TrackDrawSplitAnchor = {
  key: string;
  progress: number;
  splitIndex: number;
  title: string;
};

export type TrackDrawAnchorModel = {
  orderedSplits: TrackDrawSplitAnchor[];
  startFinishKey: string;
  startFinishProgress: number;
};

export type TrackDrawTrackModel = {
  anchorModel: TrackDrawAnchorModel;
  splitProgressMap: Record<number, number>;
};

export function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

export function normalizeProgress(progress: number): number {
  let value = progress % 1;
  if (value < 0) {
    value += 1;
  }

  return value;
}

export function forwardDelta(fromProgress: number, toProgress: number): number {
  const from = normalizeProgress(fromProgress);
  const to = normalizeProgress(toProgress);
  const delta = to - from;

  return delta < 0 ? delta + 1 : delta;
}

export function progressDistance(a: number, b: number): number {
  return Math.min(forwardDelta(a, b), forwardDelta(b, a));
}

export function isFullLapSegment(
  fromKey: string | null | undefined,
  toKey: string | null | undefined,
  anchorModel: Pick<TrackDrawAnchorModel, "startFinishKey">
): boolean {
  return fromKey === anchorModel.startFinishKey && toKey === anchorModel.startFinishKey;
}

export function getSegmentShare(
  fromProgress: number,
  toProgress: number,
  fromKey: string | null | undefined,
  toKey: string | null | undefined,
  anchorModel: Pick<TrackDrawAnchorModel, "startFinishKey">
): number {
  if (isFullLapSegment(fromKey, toKey, anchorModel)) {
    return 1;
  }

  return forwardDelta(fromProgress, toProgress);
}

export function interpolateProgress(
  fromProgress: number,
  toProgress: number,
  ratio: number,
  fromKey: string | null | undefined,
  toKey: string | null | undefined,
  anchorModel: Pick<TrackDrawAnchorModel, "startFinishKey">
): number {
  const distance = getSegmentShare(
    fromProgress,
    toProgress,
    fromKey,
    toKey,
    anchorModel
  );

  return normalizeProgress(normalizeProgress(fromProgress) + distance * clamp01(ratio));
}

export function buildTrackModel(
  timingMarkers: TrackDrawTimingMarker[] | null | undefined
): TrackDrawTrackModel {
  const splitProgressMap: Record<number, number> = {};
  let startFinishProgress = 0;
  const orderedSplits: TrackDrawSplitAnchor[] = [];

  (timingMarkers ?? []).forEach((marker) => {
    const rawProgress = marker.route_position?.progress;
    if (typeof rawProgress !== "number") {
      return;
    }

    const progress = normalizeProgress(rawProgress);

    if (marker.role === "start_finish") {
      startFinishProgress = progress;
      return;
    }

    if (
      marker.role === "split" &&
      typeof marker.split_index === "number" &&
      !Number.isNaN(marker.split_index)
    ) {
      splitProgressMap[marker.split_index] = progress;
      orderedSplits.push({
        key: `split:${marker.split_index}`,
        progress,
        splitIndex: marker.split_index,
        title: marker.title || `Split ${marker.split_index + 1}`
      });
    }
  });

  orderedSplits.sort((a, b) => {
    return (
      forwardDelta(startFinishProgress, a.progress) -
      forwardDelta(startFinishProgress, b.progress)
    );
  });

  return {
    anchorModel: {
      orderedSplits,
      startFinishKey: "sf",
      startFinishProgress
    },
    splitProgressMap
  };
}

export function getNextAnchor(
  progress: number,
  anchorModel: TrackDrawAnchorModel
): Pick<TrackDrawSplitAnchor, "key" | "progress"> {
  const current = normalizeProgress(progress);
  let nextSplit: TrackDrawSplitAnchor | null = null;
  let nextDistance = 1;

  anchorModel.orderedSplits.forEach((split) => {
    const distance = forwardDelta(current, split.progress);
    if (distance > 0.0001 && distance < nextDistance) {
      nextDistance = distance;
      nextSplit = split;
    }
  });

  if (nextSplit) {
    return nextSplit;
  }

  return {
    key: anchorModel.startFinishKey,
    progress: anchorModel.startFinishProgress
  };
}

export function getAnchorKeyForProgress(
  progress: number,
  anchorModel: TrackDrawAnchorModel
): string {
  const normalized = normalizeProgress(progress);
  let bestKey = anchorModel.startFinishKey;
  let bestDistance = progressDistance(anchorModel.startFinishProgress, normalized);

  anchorModel.orderedSplits.forEach((split) => {
    const distance = progressDistance(split.progress, normalized);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestKey = split.key;
    }
  });

  return bestKey;
}

export function getSegmentKey(
  fromKey: string | null | undefined,
  toKey: string | null | undefined
): string {
  return `${String(fromKey || "unknown")}>${String(toKey || "unknown")}`;
}
