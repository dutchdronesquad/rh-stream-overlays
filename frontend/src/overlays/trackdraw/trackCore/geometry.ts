import type { Point, TrackData, TrackField, RouteObstacle, TimingMarker } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";

// ---------------------------------------------------------------------------
// SVG element factory
// ---------------------------------------------------------------------------

export function createSvgElement<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs?: Record<string, string | number>
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, name) as SVGElementTagNameMap[K];
  if (attrs) {
    for (const key of Object.keys(attrs)) {
      el.setAttribute(key, String(attrs[key]));
    }
  }
  return el;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Generates a `<path>` d-string for a rounded rect with per-corner radii
 * (top-left, top-right, bottom-right, bottom-left).
 */
export function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  tl: number,
  tr: number,
  br: number,
  bl: number
): string {
  const cap = Math.min(w / 2, h / 2);
  const rTl = Math.min(tl, cap);
  const rTr = Math.min(tr, cap);
  const rBr = Math.min(br, cap);
  const rBl = Math.min(bl, cap);
  return (
    "M " + (x + rTl) + " " + y +
    " H " + (x + w - rTr) +
    (rTr ? " Q " + (x + w) + " " + y + " " + (x + w) + " " + (y + rTr) : "") +
    " V " + (y + h - rBr) +
    (rBr ? " Q " + (x + w) + " " + (y + h) + " " + (x + w - rBr) + " " + (y + h) : "") +
    " H " + (x + rBl) +
    (rBl ? " Q " + x + " " + (y + h) + " " + x + " " + (y + h - rBl) : "") +
    " V " + (y + rTl) +
    (rTl ? " Q " + x + " " + y + " " + (x + rTl) + " " + y : "") +
    " Z"
  );
}

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

export function hasPoint(pt: unknown): pt is Point {
  return (
    pt !== null &&
    typeof pt === "object" &&
    typeof (pt as Point).x === "number" &&
    typeof (pt as Point).y === "number"
  );
}

export function getPoint(field: TrackField, point: Point): Point {
  const y =
    field && field.origin === "bl" ? field.height - point.y : point.y;
  return { x: point.x, y };
}

export function getVisualPoint(
  field: TrackField,
  item: unknown,
  fallback?: unknown
): Point | null {
  if (hasPoint(item)) return getPoint(field, item);
  if (
    item !== null &&
    typeof item === "object" &&
    hasPoint((item as { position?: unknown }).position)
  ) {
    return getPoint(field, (item as { position: Point }).position);
  }
  if (hasPoint(fallback)) return getPoint(field, fallback);
  return null;
}

export function getRoutePath(field: TrackField, points: Point[]): string {
  return points
    .map((pt, i) => {
      const p = getPoint(field, pt);
      return (i === 0 ? "M " : "L ") + p.x + " " + p.y;
    })
    .join(" ");
}

export function hasValidField(
  field: unknown
): field is TrackField {
  return (
    field !== null &&
    typeof field === "object" &&
    typeof (field as TrackField).width === "number" &&
    (field as TrackField).width > 0 &&
    typeof (field as TrackField).height === "number" &&
    (field as TrackField).height > 0
  );
}

// ---------------------------------------------------------------------------
// Progress math
// ---------------------------------------------------------------------------

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function normalizeProgress(progress: number): number {
  let value = progress % 1;
  if (value < 0) value += 1;
  return value;
}

export function forwardDelta(fromProgress: number, toProgress: number): number {
  const from = normalizeProgress(fromProgress);
  const to = normalizeProgress(toProgress);
  let delta = to - from;
  if (delta < 0) delta += 1;
  return delta;
}

export function progressDistance(a: number, b: number): number {
  return Math.min(forwardDelta(a, b), forwardDelta(b, a));
}

// ---------------------------------------------------------------------------
// Viewport / viewBox helpers
// ---------------------------------------------------------------------------

export function getViewportAspect(): number {
  const width = window.innerWidth || document.documentElement.clientWidth || 0;
  const height = window.innerHeight || document.documentElement.clientHeight || 0;
  return width > 0 && height > 0 ? width / height : 16 / 9;
}

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function includeBoundsPoint(bounds: Bounds, point: Point | null): void {
  if (!point || typeof point.x !== "number" || typeof point.y !== "number") return;
  bounds.minX = Math.min(bounds.minX, point.x);
  bounds.minY = Math.min(bounds.minY, point.y);
  bounds.maxX = Math.max(bounds.maxX, point.x);
  bounds.maxY = Math.max(bounds.maxY, point.y);
}

function getTrackContentBounds(
  field: TrackField,
  points: Point[],
  track: TrackData
): Bounds {
  const bounds: Bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };

  for (const point of points) {
    includeBoundsPoint(bounds, getPoint(field, point));
  }
  for (const obstacle of track.route_obstacles ?? []) {
    includeBoundsPoint(
      bounds,
      getVisualPoint(field, obstacle as RouteObstacle, (obstacle as RouteObstacle).route_position)
    );
  }
  for (const marker of track.timing_markers ?? []) {
    includeBoundsPoint(
      bounds,
      getVisualPoint(field, marker as TimingMarker, (marker as TimingMarker).route_position)
    );
  }

  if (
    !isFinite(bounds.minX) ||
    !isFinite(bounds.minY) ||
    !isFinite(bounds.maxX) ||
    !isFinite(bounds.maxY)
  ) {
    return { minX: 0, minY: 0, maxX: field.width, maxY: field.height };
  }

  return bounds;
}

function expandBoundsToAspect(bounds: Bounds, aspect: number, fieldScale: number): Bounds {
  let width = Math.max(bounds.maxX - bounds.minX, fieldScale * 0.1);
  let height = Math.max(bounds.maxY - bounds.minY, fieldScale * 0.1);
  const currentAspect = width / height;
  const centerX = bounds.minX + width / 2;
  const centerY = bounds.minY + height / 2;

  if (currentAspect < aspect) {
    width = height * aspect;
  } else {
    height = width / aspect;
  }

  return {
    minX: centerX - width / 2,
    minY: centerY - height / 2,
    maxX: centerX + width / 2,
    maxY: centerY + height / 2,
  };
}

export function setSafeViewBox(
  svgEl: SVGSVGElement,
  field: TrackField,
  points: Point[],
  track: TrackData,
  fieldScale: number
): void {
  const bounds = getTrackContentBounds(field, points, track);
  const basePadding = fieldScale * 0.075;
  const topPadding = fieldScale * 0.12;
  const padded: Bounds = {
    minX: bounds.minX - basePadding,
    minY: bounds.minY - topPadding,
    maxX: bounds.maxX + basePadding,
    maxY: bounds.maxY + basePadding,
  };
  const framed = expandBoundsToAspect(padded, getViewportAspect(), fieldScale);
  svgEl.setAttribute(
    "viewBox",
    [
      framed.minX,
      framed.minY,
      framed.maxX - framed.minX,
      framed.maxY - framed.minY,
    ].join(" ")
  );
}
