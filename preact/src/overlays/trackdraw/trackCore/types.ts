// ---------------------------------------------------------------------------
// Geometry primitives
// ---------------------------------------------------------------------------

export type Point = {
  x: number;
  y: number;
};

export type PointWithAngle = Point & {
  angle: number;
};

// ---------------------------------------------------------------------------
// Track data shapes (from track.json API)
// ---------------------------------------------------------------------------

export type TrackField = {
  width: number;
  height: number;
  origin?: string;
};

export type RoutePosition = {
  progress: number;
};

export type TimingMarker = {
  role?: string;
  split_index?: number;
  title?: string;
  route_position?: RoutePosition;
  x?: number;
  y?: number;
  position?: Point;
};

export type RouteObstacle = {
  route_position?: RoutePosition;
  x?: number;
  y?: number;
  position?: Point;
};

export type TrackRoute = {
  sampled_points?: Point[];
  waypoints?: Point[];
};

export type TrackReadiness = {
  status?: string;
  summary?: string;
  issues?: Array<{ message?: string; type?: string; detail?: string }>;
  issue_count?: number;
};

export type TrackDurationEstimate = {
  estimated_lap_ms?: number;
};

export type TrackData = {
  field: TrackField;
  route?: TrackRoute;
  route_obstacles?: RouteObstacle[];
  timing_markers?: TimingMarker[];
  readiness?: TrackReadiness;
  duration_estimate?: TrackDurationEstimate;
  title?: string;
};

// ---------------------------------------------------------------------------
// Anchor / track model
// ---------------------------------------------------------------------------

export type AnchorPoint = {
  key: string;
  progress: number;
  splitIndex?: number;
  title?: string;
};

export type AnchorModel = {
  startFinishProgress: number;
  startFinishKey: string;
  orderedSplits: AnchorPoint[];
};

export type TrackModel = {
  splitProgressMap: Record<number, number>;
  anchorModel: AnchorModel;
};

// ---------------------------------------------------------------------------
// Pilot state
// ---------------------------------------------------------------------------

export type PilotState = {
  nodeIndex: number;
  callsign: string;
  color: string;
  active: boolean;
  lapCount: number;
  position: number | null;

  // Anchor interpolation
  lastAnchorProgress: number;
  lastAnchorKey: string;
  nextAnchorProgress: number;
  nextAnchorKey: string;
  lastAnchorTime: number | null;
  lastTimingAt: number | null;

  // Pace estimation
  expectedSegmentMs: number;
  expectedSegmentMsByKey: Record<string, number>;
  expectedLapMs: number;
  hasLearnedPace: boolean;

  // Confidence / correction
  confidence: string;
  lastSeenAt: number | null;
  correctionStartTime: number | null;
  correctionEndTime: number | null;

  // Per-frame caching (avoids redundant DOM updates)
  _frameClass: string | null;
  _frameTransform: string | null;
  _frameColor: string | null;
  _markerTransform: string | null;
  _labelLayoutKey: string | null;
};

// ---------------------------------------------------------------------------
// Heat node (from raceStore currentHeat.heatNodes)
// ---------------------------------------------------------------------------

export type HeatNode = {
  callsign?: unknown;
  activeColor?: unknown;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// SVG element cache (replaces _trackdrawEls duck-typing)
// ---------------------------------------------------------------------------

export type PilotElements = {
  halo: SVGCircleElement;
  marker: SVGGElement;
  arrow: SVGPolygonElement;
  callsignBg: SVGPathElement;
  callsignText: SVGTextElement;
};

// ---------------------------------------------------------------------------
// Full renderer state (managed internally by createTrackDrawRenderer)
// ---------------------------------------------------------------------------

export type TrackDrawRendererState = {
  trackData: TrackData | null;
  sampledPoints: Point[];
  splitProgressMap: Record<number, number>;
  anchorModel: AnchorModel;
  pilots: Record<string, PilotState>;
  prevLapCounts: Record<string, number>;
  prevSplitCounts: Record<string, number>;
  raceRunning: boolean;
  socketConnected: boolean;
  baselineLapMs: number;
  trackLoadPending: boolean;
  animationRunning: boolean;
  fieldScale: number;
  visualScale: number;
};
