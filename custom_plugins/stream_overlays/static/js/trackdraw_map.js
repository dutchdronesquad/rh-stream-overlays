(function (window, document) {
  "use strict";

  if (window.rotorhazard) {
    window.rotorhazard.show_messages = false;
  }

  var SVG_NS = "http://www.w3.org/2000/svg";
  var theme = (window.trackdrawOverlayTheme || "").toLowerCase();
  var DEFAULT_LAP_MS = 30000;
  var STALE_WINDOW_MS = 8000;
  var EMA_ALPHA = 0.35;
  var CONFIDENCE_HIGH_MS = 2500;
  var ANCHOR_CORRECTION_MS = 650;
  var CORRECTION_FADE_THRESHOLD_PROGRESS = 0.025;
  var LAP_ROLLOVER_CONTINUITY_PROGRESS = 0.18;
  var MIN_OBSERVED_SEGMENT_MS = 600;

  // Set in renderTrack from the actual track field diagonal (meters).
  // All SVG sizes are derived as fractions of this value so proportions
  // stay correct regardless of how large or small the physical course is.
  var fieldScale = 72;

  // Boosted at small viewport sizes so route lines and pilot dots remain
  // legible when the overlay is used as a map browser source.
  var visualScale = 1.0;

  // ---- Track state ----
  var trackData = null;
  var sampledPoints = [];
  var splitProgressMap = {};  // split_index(number) -> route progress (0..1)
  var anchorModel = {
    startFinishProgress: 0,
    startFinishKey: "sf",
    orderedSplits: [],
  };

  // ---- Pilot state, keyed by nodeIndex as string ----
  var pilots = {};

  // ---- Previous snapshots for diffing current_laps ----
  var prevLapCounts = {};    // nodeIdx(str) -> number of laps
  var prevSplitCounts = {};  // "nodeIdx:lapArrayIdx" -> number of splits

  // ---- Race state ----
  var raceRunning = false;
  var socketConnected = true;
  var baselineLapMs = DEFAULT_LAP_MS;
  var trackLoadPending = false;
  var animationRunning = false;

  // ---- SVG elements ----
  var svgEl = null;
  var pilotGroupEl = null;
  var rootEl = null;

  function getRoot() {
    return rootEl || (rootEl = document.querySelector(".trackdraw-map"));
  }

  // ----------------------------------------------------------------
  // SVG helpers
  // ----------------------------------------------------------------

  function createSvgElement(name, attrs) {
    var el = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (k) {
      el.setAttribute(k, String(attrs[k]));
    });
    return el;
  }

  // Generates a <path> d-string for a rect with per-corner radii (tl, tr, br, bl).
  function roundedRectPath(x, y, w, h, tl, tr, br, bl) {
    var cap = Math.min(w / 2, h / 2);
    var r_tl = Math.min(tl, cap), r_tr = Math.min(tr, cap);
    var r_br = Math.min(br, cap), r_bl = Math.min(bl, cap);
    return (
      "M " + (x + r_tl) + " " + y +
      " H " + (x + w - r_tr) +
      (r_tr ? " Q " + (x + w) + " " + y + " " + (x + w) + " " + (y + r_tr) : "") +
      " V " + (y + h - r_br) +
      (r_br ? " Q " + (x + w) + " " + (y + h) + " " + (x + w - r_br) + " " + (y + h) : "") +
      " H " + (x + r_bl) +
      (r_bl ? " Q " + x + " " + (y + h) + " " + x + " " + (y + h - r_bl) : "") +
      " V " + (y + r_tl) +
      (r_tl ? " Q " + x + " " + y + " " + (x + r_tl) + " " + y : "") +
      " Z"
    );
  }

  function getPoint(field, point) {
    var y = point.y;
    if (field && field.origin === "bl") {
      y = field.height - point.y;
    }
    return { x: point.x, y: y };
  }

  function getVisualPoint(field, item, fallback) {
    if (hasPoint(item)) return getPoint(field, item);
    if (item && hasPoint(item.position)) return getPoint(field, item.position);
    if (hasPoint(fallback)) return getPoint(field, fallback);
    return null;
  }

  function getRoutePath(field, points) {
    return points
      .map(function (pt, i) {
        var p = getPoint(field, pt);
        return (i === 0 ? "M " : "L ") + p.x + " " + p.y;
      })
      .join(" ");
  }

  function hasValidField(field) {
    return field && field.width > 0 && field.height > 0;
  }

  function hasPoint(pt) {
    return pt && typeof pt.x === "number" && typeof pt.y === "number";
  }

  function clamp01(value) {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }

  function normalizeProgress(progress) {
    var value = progress % 1;
    if (value < 0) value += 1;
    return value;
  }

  function forwardDelta(fromProgress, toProgress) {
    var from = normalizeProgress(fromProgress);
    var to = normalizeProgress(toProgress);
    var delta = to - from;
    if (delta < 0) delta += 1;
    return delta;
  }

  function progressDistance(a, b) {
    return Math.min(forwardDelta(a, b), forwardDelta(b, a));
  }

  function isFullLapSegment(fromKey, toKey) {
    return fromKey === anchorModel.startFinishKey && toKey === anchorModel.startFinishKey;
  }

  function getSegmentShare(fromProgress, toProgress, fromKey, toKey) {
    if (isFullLapSegment(fromKey, toKey)) return 1;
    return forwardDelta(fromProgress, toProgress);
  }

  function interpolateProgress(fromProgress, toProgress, ratio, fromKey, toKey) {
    var distance = getSegmentShare(fromProgress, toProgress, fromKey, toKey);
    return normalizeProgress(
      normalizeProgress(fromProgress) + distance * clamp01(ratio)
    );
  }

  // ----------------------------------------------------------------
  // Route geometry
  // ----------------------------------------------------------------

  function progressToPoint(progress) {
    if (!sampledPoints.length || !trackData) return null;
    var field = trackData.field;
    var clamped = normalizeProgress(progress);
    var idx = clamped * (sampledPoints.length - 1);
    var i = Math.floor(idx);
    var t = idx - i;
    if (i >= sampledPoints.length - 1) {
      return getPoint(field, sampledPoints[sampledPoints.length - 1]);
    }
    var a = sampledPoints[i];
    var b = sampledPoints[i + 1];
    return getPoint(field, {
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y),
    });
  }

  function progressToPointWithAngle(progress) {
    var point = progressToPoint(progress);
    if (!point || sampledPoints.length < 2 || !trackData) return null;

    var tangentDelta = Math.max(0.003, 1 / (sampledPoints.length - 1));
    var a = progressToPoint(progress - tangentDelta);
    var b = progressToPoint(progress + tangentDelta);
    var angle = a && b ? Math.atan2(b.y - a.y, b.x - a.x) : 0;

    return {
      x: point.x,
      y: point.y,
      angle: angle,
    };
  }

  // Single pass over timing markers that builds both the split progress map
  // (split_index → route progress, used for current_laps diffing) and the
  // anchor model (ordered splits + S/F metadata, used for interpolation).
  function buildTrackModel(timingMarkers) {
    var localSplitMap = {};
    var startFinishProgress = 0;
    var splits = [];

    (timingMarkers || []).forEach(function (marker) {
      if (
        !marker ||
        !marker.route_position ||
        typeof marker.route_position.progress !== "number"
      ) {
        return;
      }

      var progress = normalizeProgress(marker.route_position.progress);

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
          progress: progress,
          title: marker.title || "Split " + (marker.split_index + 1),
        });
      }
    });

    splits.sort(function (a, b) {
      return (
        forwardDelta(startFinishProgress, a.progress) -
        forwardDelta(startFinishProgress, b.progress)
      );
    });

    return {
      splitProgressMap: localSplitMap,
      anchorModel: {
        startFinishProgress: startFinishProgress,
        startFinishKey: "sf",
        orderedSplits: splits,
      },
    };
  }

  function getNextAnchor(progress) {
    var current = normalizeProgress(progress);
    var splits = anchorModel.orderedSplits || [];
    var nextSplit = null;
    var nextDistance = 1;

    splits.forEach(function (split) {
      var distance = forwardDelta(current, split.progress);
      if (distance > 0.0001 && distance < nextDistance) {
        nextDistance = distance;
        nextSplit = split;
      }
    });

    if (nextSplit) return nextSplit;
    return {
      key: anchorModel.startFinishKey,
      progress: anchorModel.startFinishProgress,
    };
  }

  function getAnchorKeyForProgress(progress) {
    var normalized = normalizeProgress(progress);
    var bestKey = anchorModel.startFinishKey;
    var bestDistance = progressDistance(anchorModel.startFinishProgress, normalized);

    (anchorModel.orderedSplits || []).forEach(function (split) {
      var distance = progressDistance(split.progress, normalized);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestKey = split.key;
      }
    });

    return bestKey;
  }

  function getSegmentKey(fromKey, toKey) {
    return String(fromKey || "unknown") + ">" + String(toKey || "unknown");
  }

  function updateExpectedSegmentMs(pilot, fromKey, toKey, segmentMs) {
    if (
      !pilot ||
      !fromKey ||
      !toKey ||
      typeof segmentMs !== "number" ||
      segmentMs < MIN_OBSERVED_SEGMENT_MS
    ) {
      return;
    }

    var key = getSegmentKey(fromKey, toKey);
    var current = pilot.expectedSegmentMsByKey[key];
    pilot.expectedSegmentMsByKey[key] =
      typeof current === "number"
        ? Math.round(EMA_ALPHA * segmentMs + (1 - EMA_ALPHA) * current)
        : Math.round(segmentMs);
  }

  function getExpectedSegmentMs(pilot, fromProgress, toProgress, fromKey, toKey) {
    var segmentKey = getSegmentKey(fromKey, toKey);
    var segmentMs =
      pilot.expectedSegmentMsByKey && pilot.expectedSegmentMsByKey[segmentKey];
    if (typeof segmentMs === "number" && segmentMs > 0) {
      return segmentMs;
    }

    var lapMs = pilot.expectedLapMs || getBaselineLapMs();
    var share = getSegmentShare(fromProgress, toProgress, fromKey, toKey);
    return Math.max(1200, Math.round(lapMs * share));
  }

  function getValidDurationEstimateMs(track) {
    var estimate = track && track.duration_estimate;
    var value = estimate && estimate.estimated_lap_ms;
    if (typeof value !== "number" || !isFinite(value) || value <= 0) {
      return null;
    }
    return Math.round(value);
  }

  function getBaselineLapMs() {
    return baselineLapMs || DEFAULT_LAP_MS;
  }

  function applyBaselineToUnlearnedPilots() {
    Object.keys(pilots).forEach(function (nodeIdx) {
      var pilot = pilots[nodeIdx];
      if (!pilot || pilot.hasLearnedPace === true) return;
      pilot.expectedLapMs = getBaselineLapMs();
      pilot.expectedSegmentMs = getExpectedSegmentMs(
        pilot,
        pilot.lastAnchorProgress,
        pilot.nextAnchorProgress,
        pilot.lastAnchorKey,
        pilot.nextAnchorKey
      );
    });
  }

  function setBaselineLapMs(track) {
    baselineLapMs = getValidDurationEstimateMs(track) || DEFAULT_LAP_MS;
    applyBaselineToUnlearnedPilots();
  }

  // ----------------------------------------------------------------
  // Color helper
  // ----------------------------------------------------------------

  function toHexColor(colorval) {
    if (!colorval) return "#ffffff";
    if (typeof window.colorvalToHex === "function") {
      return window.colorvalToHex(colorval);
    }
    return "#" + colorval.toString(16).padStart(6, "0");
  }

  function getContrastColor(color) {
    if (typeof window.contrastColor === "function") {
      return window.contrastColor(color);
    }

    var hex = String(color || "#ffffff").replace("#", "");
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map(function (char) {
          return char + char;
        })
        .join("");
    }

    var value = parseInt(hex, 16);
    if (isNaN(value)) return "#000000";

    var r = (value >> 16) & 255;
    var g = (value >> 8) & 255;
    var b = value & 255;
    var luminance = (r * 299 + g * 587 + b * 114) / 1000;
    return luminance > 145 ? "#06100d" : "#ffffff";
  }

  // ----------------------------------------------------------------
  // UI helpers
  // ----------------------------------------------------------------

  function showMessage(text) {
    var msgEl = document.getElementById("trackdraw-map-message");
    if (msgEl) {
      msgEl.textContent = text || "TrackDraw map is not ready.";
      msgEl.classList.add("is-visible");
    }
  }

  function hideMessage() {
    var msgEl = document.getElementById("trackdraw-map-message");
    if (msgEl) msgEl.classList.remove("is-visible");
  }

  function clearSvg(svg) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  function applyViewportClass() {
    var root = getRoot();
    if (!root) return;

    var width = window.innerWidth || document.documentElement.clientWidth || 0;
    var height = window.innerHeight || document.documentElement.clientHeight || 0;
    var aspect = height > 0 ? width / height : 16 / 9;
    var is16x9 = Math.abs(aspect - 16 / 9) < 0.04;
    var compact = width < 560 || height < 360;
    var tiny = width < 380 || height < 250;

    root.classList.toggle("is-compact", compact);
    root.classList.toggle("is-tiny", tiny);
    root.classList.toggle("is-obs-1080", is16x9 && width >= 1800 && height >= 1000);
    root.classList.toggle(
      "is-obs-720",
      is16x9 && width >= 1180 && width < 1800 && height >= 650
    );
  }

  function updatePilotDensityClass(activeCount) {
    var root = getRoot();
    if (!root) return;
    root.classList.toggle("is-crowded", activeCount >= 5);
    root.classList.toggle("is-packed", activeCount >= 7);
  }

  function getViewportAspect() {
    var width = window.innerWidth || document.documentElement.clientWidth || 0;
    var height = window.innerHeight || document.documentElement.clientHeight || 0;
    return width > 0 && height > 0 ? width / height : 16 / 9;
  }

  function includeBoundsPoint(bounds, point) {
    if (!point || typeof point.x !== "number" || typeof point.y !== "number") return;
    bounds.minX = Math.min(bounds.minX, point.x);
    bounds.minY = Math.min(bounds.minY, point.y);
    bounds.maxX = Math.max(bounds.maxX, point.x);
    bounds.maxY = Math.max(bounds.maxY, point.y);
  }

  function getTrackContentBounds(field, points, track) {
    var bounds = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    };

    points.forEach(function (point) {
      includeBoundsPoint(bounds, getPoint(field, point));
    });
    (track.route_obstacles || []).forEach(function (obstacle) {
      includeBoundsPoint(bounds, getVisualPoint(field, obstacle, obstacle.route_position));
    });
    (track.timing_markers || []).forEach(function (marker) {
      includeBoundsPoint(bounds, getVisualPoint(field, marker, marker.route_position));
    });

    if (
      !isFinite(bounds.minX) ||
      !isFinite(bounds.minY) ||
      !isFinite(bounds.maxX) ||
      !isFinite(bounds.maxY)
    ) {
      return {
        minX: 0,
        minY: 0,
        maxX: field.width,
        maxY: field.height,
      };
    }

    return bounds;
  }

  function expandBoundsToAspect(bounds, aspect) {
    var width = Math.max(bounds.maxX - bounds.minX, fieldScale * 0.1);
    var height = Math.max(bounds.maxY - bounds.minY, fieldScale * 0.1);
    var currentAspect = width / height;
    var centerX = bounds.minX + width / 2;
    var centerY = bounds.minY + height / 2;

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

  function setSafeViewBox(field, points, track) {
    var bounds = getTrackContentBounds(field, points, track);
    var basePadding = fieldScale * 0.075;
    var topPadding = fieldScale * 0.12;
    var padded = {
      minX: bounds.minX - basePadding,
      minY: bounds.minY - topPadding,
      maxX: bounds.maxX + basePadding,
      maxY: bounds.maxY + basePadding,
    };
    var framed = expandBoundsToAspect(padded, getViewportAspect());

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

  // ----------------------------------------------------------------
  // Track rendering (static layer)
  // ----------------------------------------------------------------

  function renderFinishLine(svg, pt, angle, r) {
    var tickSize = r * 2.8;
    var finishLine = createSvgElement("g", {
      class: "trackdraw-map__finish-line",
      transform:
        "translate(" + pt.x + " " + pt.y + ") rotate(" + (angle * 180) / Math.PI + ")",
    });

    [-1, 1].forEach(function (side) {
      var cap = createSvgElement("rect", {
        class: "trackdraw-map__finish-line-cap",
        x: -r * 0.75,
        y: side * tickSize - r * 0.34,
        width: r * 1.5,
        height: r * 0.68,
        rx: r * 0.12,
      });
      cap.style.strokeWidth = String(r * 0.08);
      finishLine.appendChild(cap);
    });

    var blockRows = 6;
    var blockH = (tickSize * 2) / blockRows;
    var blockW = r * 0.52;
    for (var row = 0; row < blockRows; row++) {
      for (var col = 0; col < 2; col++) {
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

  function renderTrack(track, cacheState) {
    svgEl = document.getElementById("trackdraw-map-svg");
    if (!svgEl) {
      showMessage("SVG mount missing.");
      return false;
    }
    if (!track || !track.route || !hasValidField(track.field)) {
      showMessage("No ready TrackDraw route.");
      return false;
    }
    if (!track.readiness || track.readiness.status !== "ready") {
      showMessage("TrackDraw setup is blocked.");
      return false;
    }

    var field = track.field;
    var points = (track.route.sampled_points || track.route.waypoints || []).filter(hasPoint);
    if (points.length <= 1) {
      showMessage("Route has no drawable points.");
      return false;
    }

    // Derive proportional sizes from the field diagonal so elements look
    // correct at any physical track scale (small club field or large venue).
    fieldScale = Math.sqrt(field.width * field.width + field.height * field.height);

    // Scale up visual element sizes at small viewport dimensions so route
    // lines and pilot dots remain legible when used as a map source.
    var minDim = Math.min(window.innerWidth || 1920, window.innerHeight || 1080);
    visualScale = minDim < 300 ? 2.8
                : minDim < 420 ? 2.2
                : minDim < 600 ? 1.7
                : minDim < 900 ? 1.3
                : 1.0;

    var vs = visualScale;
    var vsT = Math.min(vs, 1.5);
    var routeShadowW = fieldScale * 0.016 * vs;
    var routeOuterW = fieldScale * 0.010 * vs;
    var routeInnerW = fieldScale * 0.006 * vs;
    var gateR = fieldScale * 0.006 * vs;
    var gateCoreR = fieldScale * 0.0027 * vs;
    var gateSwW = fieldScale * 0.0017 * vs;
    var timingSfR = fieldScale * 0.013 * vsT;
    var timingR   = fieldScale * 0.010 * vsT;
    var timingSwW = fieldScale * 0.003 * vsT;

    clearSvg(svgEl);
    setSafeViewBox(field, points, track);

    var routeD = getRoutePath(field, points);
    [
      ["trackdraw-map__route-shadow", routeShadowW],
      ["trackdraw-map__route-outline", routeOuterW],
      ["trackdraw-map__route", routeInnerW],
    ].forEach(function (layer) {
      var routeLayerPath = createSvgElement("path", {
        class: layer[0],
        d: routeD,
      });
      routeLayerPath.style.strokeWidth = String(layer[1]);
      svgEl.appendChild(routeLayerPath);
    });

    (track.route_obstacles || []).forEach(function (obstacle) {
      if (
        !obstacle.route_position ||
        typeof obstacle.route_position.progress !== "number"
      ) {
        return;
      }
      var gatePoint = getVisualPoint(field, obstacle, obstacle.route_position);
      if (!gatePoint) return;
      var gate = createSvgElement("g", {
        class: "trackdraw-map__gate",
        transform: "translate(" + gatePoint.x + " " + gatePoint.y + ")",
      });
      var marker = createSvgElement("circle", {
        class: "trackdraw-map__gate-marker",
        r: gateR,
      });
      marker.style.strokeWidth = String(gateSwW);
      var core = createSvgElement("circle", {
        class: "trackdraw-map__gate-marker-core",
        r: gateCoreR,
      });
      gate.appendChild(marker);
      gate.appendChild(core);
      svgEl.appendChild(gate);
    });

    (track.timing_markers || []).forEach(function (marker) {
      if (!marker.route_position) return;
      var pt = getVisualPoint(field, marker, marker.route_position);
      if (!pt) return;
      var isStartFinish = marker.role === "start_finish";
      var r = isStartFinish ? timingSfR : timingR;
      var routePoint = progressToPointWithAngle(marker.route_position.progress);
      var angle = routePoint ? routePoint.angle : 0;
      var normal = angle + Math.PI / 2;
      var tickSize = isStartFinish ? r * 2.8 : r * 2.1;

      var tick = createSvgElement("line", {
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
    });

    // Pilot group always rendered on top
    pilotGroupEl = createSvgElement("g", { class: "trackdraw-map__pilots" });
    svgEl.appendChild(pilotGroupEl);

    hideMessage();
    return true;
  }

  // ----------------------------------------------------------------
  // Pilot rendering (dynamic layer)
  // ----------------------------------------------------------------

  function ensurePilotEl(pilot) {
    var id = "td-pilot-" + pilot.nodeIndex;
    var existing = document.getElementById(id);
    if (existing) {
      if (!existing._trackdrawEls) {
        existing._trackdrawEls = {
          halo: existing.querySelector(".trackdraw-map__pilot-halo"),
          marker: existing.querySelector(".trackdraw-map__pilot-marker"),
          arrow: existing.querySelector(".trackdraw-map__pilot"),
          callsignBg: existing.querySelector(".trackdraw-map__pilot-callsign-bg"),
          callsignText: existing.querySelector(".trackdraw-map__pilot-callsign"),
        };
      }
      return existing;
    }
    if (!pilotGroupEl) return;

    var g = createSvgElement("g", { id: id, class: "trackdraw-map__pilot-group" });
    pilot._frameClass = null;
    pilot._frameTransform = null;
    pilot._frameColor = null;
    pilot._markerTransform = null;
    pilot._labelLayoutKey = null;

    var vs = visualScale;
    var pilotR = fieldScale * 0.010 * vs;
    var halo = createSvgElement("circle", {
      class: "trackdraw-map__pilot-halo",
      r: pilotR * 1.9,
    });
    halo.style.strokeWidth = String(fieldScale * 0.0032 * vs);

    var marker = createSvgElement("g", { class: "trackdraw-map__pilot-marker" });
    var arrowLen = fieldScale * 0.019 * vs;
    var arrowW = fieldScale * 0.009 * vs;
    var arrow = createSvgElement("polygon", {
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

    // Label: single colored callsign badge, no connector.
    // <path> allows per-corner rounding so each theme can have a distinct shape.
    var callsignBg = createSvgElement("path", { class: "trackdraw-map__pilot-callsign-bg" });

    var callsignText = createSvgElement("text", { class: "trackdraw-map__pilot-callsign" });
    callsignText.style.fontSize = fieldScale * 0.0158 * vs + "px";
    callsignText.textContent = getPilotLabel(pilot);

    g.appendChild(halo);
    g.appendChild(marker);
    g.appendChild(callsignBg);
    g.appendChild(callsignText);
    g._trackdrawEls = {
      halo: halo,
      marker: marker,
      arrow: arrow,
      callsignBg: callsignBg,
      callsignText: callsignText,
    };
    pilotGroupEl.appendChild(g);
    return g;
  }

  function clearPilotEls() {
    if (!pilotGroupEl) return;
    while (pilotGroupEl.firstChild) pilotGroupEl.removeChild(pilotGroupEl.firstChild);
  }

  function getPilotLabel(pilot) {
    return (pilot.callsign || "N" + (pilot.nodeIndex + 1)).slice(0, 4).toUpperCase();
  }

  var LABEL_DIRECTIONS = [
    { x: 0, y: -1 },
    { x: 0.68, y: -0.73 },
    { x: -0.68, y: -0.73 },
    { x: 0.96, y: -0.28 },
    { x: -0.96, y: -0.28 },
    { x: 0, y: 1 },
  ];

  function getLabelSlot(pilot) {
    var index = Number(pilot.nodeIndex);
    return isNaN(index) ? 0 : Math.abs(index) % LABEL_DIRECTIONS.length;
  }

  function getLabelOffset(slot) {
    var directions = LABEL_DIRECTIONS;
    var direction = directions[slot] || directions[0];
    var length = Math.sqrt(direction.x * direction.x + direction.y * direction.y) || 1;
    var radius = fieldScale * 0.044 * visualScale;
    return {
      x: (direction.x / length) * radius,
      y: (direction.y / length) * radius,
    };
  }

  function setPilotAnchor(pilot, progress, options) {
    var opts = options || {};
    var now = window.performance.now();
    var normalized = normalizeProgress(progress);
    var anchorKey = opts.anchorKey || getAnchorKeyForProgress(normalized);
    var currentProgress = getCurrentPilotProgress(pilot);
    var currentAnchorKey = pilot.lastAnchorKey || getAnchorKeyForProgress(pilot.lastAnchorProgress);
    var correctionMs = opts.easeMs || ANCHOR_CORRECTION_MS;
    var nextAnchor = getNextAnchor(normalized);
    var segmentMs = getExpectedSegmentMs(
      pilot,
      normalized,
      nextAnchor.progress,
      anchorKey,
      nextAnchor.key
    );
    var carriedElapsedMs = null;
    var segmentShare = getSegmentShare(
      normalized,
      nextAnchor.progress,
      anchorKey,
      nextAnchor.key
    );
    var progressFromAnchor = forwardDelta(normalized, currentProgress);

    if (opts.rollover === true && segmentShare > 0) {
      var continuityThreshold = Math.min(LAP_ROLLOVER_CONTINUITY_PROGRESS, segmentShare * 0.6);
      var progressPastAnchor = null;
      if (progressFromAnchor > 0 && progressFromAnchor <= continuityThreshold) {
        // Estimated slightly ahead of S/F — normal case
        progressPastAnchor = progressFromAnchor;
      } else if (progressFromAnchor >= 1 - continuityThreshold) {
        // Estimated just before S/F (approaching) — mirror into new-lap distance
        progressPastAnchor = 1 - progressFromAnchor;
      }
      if (progressPastAnchor !== null) {
        carriedElapsedMs = Math.round(segmentMs * (progressPastAnchor / segmentShare));
      }
    }

    var pilotIsApproaching = progressFromAnchor >= 1 - LAP_ROLLOVER_CONTINUITY_PROGRESS;
    var shouldFadeCorrection =
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
    pilot.confidence = opts.confidence || "high";
    pilot.lastSeenAt = now;
    pilot.lastTimingAt = now;
    pilot.correctionStartTime = shouldFadeCorrection ? now : null;
    pilot.correctionEndTime = shouldFadeCorrection ? now + correctionMs : null;
  }

  function isPilotCorrecting(pilot) {
    var now = window.performance.now();
    return (
      pilot.correctionStartTime !== null &&
      pilot.correctionEndTime !== null &&
      now < pilot.correctionEndTime
    );
  }

  function getCurrentPilotProgress(pilot) {
    var now = window.performance.now();
    if (pilot.lastAnchorTime === null || !raceRunning) {
      return pilot.lastAnchorProgress;
    }
    if (now < pilot.lastAnchorTime) {
      return pilot.lastAnchorProgress;
    }
    var elapsed = now - pilot.lastAnchorTime;
    var segmentMs = getEffectiveSegmentMs(pilot);
    var ratio = elapsed / segmentMs;

    if (ratio <= 1.0) {
      return interpolateProgress(
        pilot.lastAnchorProgress,
        pilot.nextAnchorProgress,
        ratio,
        pilot.lastAnchorKey,
        pilot.nextAnchorKey
      );
    }
    var segmentEnd = normalizeProgress(pilot.nextAnchorProgress);
    var overProgress = (elapsed - segmentMs) / segmentMs;
    return normalizeProgress(segmentEnd + overProgress);
  }

  function estimateProgress(pilot) {
    if (pilot.lastAnchorTime === null || !raceRunning || !socketConnected) {
      return pilot.lastAnchorProgress;
    }
    return getCurrentPilotProgress(pilot);
  }

  function getEffectiveSegmentMs(pilot) {
    return pilot.expectedSegmentMs || pilot.expectedLapMs || getBaselineLapMs();
  }

  function getConfiguredMinLapMs() {
    if (
      typeof rotorhazard !== "undefined" &&
      typeof rotorhazard.min_lap === "number" &&
      rotorhazard.min_lap > 0
    ) {
      return rotorhazard.min_lap * 1000;
    }
    return null;
  }

  function getStaleWindowMs() {
    return getConfiguredMinLapMs() || STALE_WINDOW_MS;
  }

  function isPilotStale(pilot) {
    if (pilot.lastAnchorTime === null || !raceRunning) return false;
    var elapsed = window.performance.now() - pilot.lastAnchorTime;
    var segmentMs = getEffectiveSegmentMs(pilot);
    return elapsed > segmentMs + getStaleWindowMs();
  }

  function getPilotConfidence(pilot) {
    if (!socketConnected && raceRunning) return "stale";
    if (isPilotStale(pilot)) return "stale";
    if (!raceRunning || pilot.lastAnchorTime === null) return "idle";
    if (pilot.confidence === "low") return "low";

    var elapsed = window.performance.now() - pilot.lastAnchorTime;
    var segmentMs = getEffectiveSegmentMs(pilot);
    if (elapsed < CONFIDENCE_HIGH_MS) return "high";
    if (elapsed > segmentMs * 0.85) return "low";
    return "medium";
  }

  function getLapTimeMs(lap) {
    if (!lap) return null;
    if (lap.deleted === true) return null;
    var value = null;

    if (typeof lap.lap_time === "number") {
      value = lap.lap_time;
    } else if (typeof lap.lap_raw === "number") {
      value = lap.lap_raw;
    } else if (typeof lap.lap_time === "string" && lap.lap_time.trim() !== "") {
      value = Number(lap.lap_time);
    }

    return typeof value === "number" && !isNaN(value) && value > 0 ? value : null;
  }

  function getActiveLaps(laps) {
    if (!Array.isArray(laps)) return [];
    return laps.filter(function (lap) {
      return lap && lap.deleted !== true;
    });
  }

  function updateExpectedLapMs(pilot, lapMs) {
    if (typeof lapMs !== "number" || lapMs <= 0) return;
    var minLapMs = getConfiguredMinLapMs();
    if (minLapMs !== null && lapMs < minLapMs) return;

    if (pilot.hasLearnedPace !== true) {
      pilot.expectedLapMs = lapMs;
    } else {
      pilot.expectedLapMs = Math.round(
        EMA_ALPHA * lapMs + (1 - EMA_ALPHA) * pilot.expectedLapMs
      );
    }
    pilot.hasLearnedPace = true;
  }

  function learnLapSamples(pilot, laps, startIndex) {
    for (var i = startIndex; i < laps.length; i++) {
      var lapNumber = Number(laps[i].lap_number);
      if (lapNumber > 0) {
        updateExpectedLapMs(pilot, getLapTimeMs(laps[i]));
      }
    }
  }

  function animationTick() {
    if (svgEl && pilotGroupEl) {
      var activeNodeIndexes = Object.keys(pilots).filter(function (nodeIdx) {
        return pilots[nodeIdx] && pilots[nodeIdx].active;
      });
      updatePilotDensityClass(activeNodeIndexes.length);

      activeNodeIndexes.forEach(function (nodeIdx) {
        var pilot = pilots[nodeIdx];

        var g = ensurePilotEl(pilot);
        if (!g) return;
        var els = g._trackdrawEls || {};

        var progress = estimateProgress(pilot);
        var routePoint = progressToPointWithAngle(progress);
        if (!routePoint) return;
        var pt = { x: routePoint.x, y: routePoint.y };

        var labelSlot = getLabelSlot(pilot);
        var labelOffset = getLabelOffset(labelSlot);

        var position = Number(pilot.position);
        var hasPosition = !isNaN(position) && position > 0;
        var confidence = getPilotConfidence(pilot);
        var isLeader = position === 1;
        var hideLabel =
          activeNodeIndexes.length >= 7 &&
          !isLeader &&
          (!hasPosition || position > 4);
        var groupClass = "trackdraw-map__pilot-group is-" + confidence;
        if (isLeader) {
          groupClass += " is-leader";
        }
        if (isPilotCorrecting(pilot)) {
          groupClass += " is-correcting";
        }
        if (hideLabel) {
          groupClass += " is-label-hidden";
        }
        if (pilot._frameClass !== groupClass) {
          g.setAttribute("class", groupClass);
          pilot._frameClass = groupClass;
        }
        var groupTransform = "translate(" + pt.x + " " + pt.y + ")";
        if (pilot._frameTransform !== groupTransform) {
          g.setAttribute("transform", groupTransform);
          pilot._frameTransform = groupTransform;
        }
        if (isLeader && g.parentNode === pilotGroupEl && g !== pilotGroupEl.lastChild) {
          pilotGroupEl.appendChild(g);
        }

        var label = getPilotLabel(pilot);

        if (pilot._frameColor !== pilot.color) {
          if (els.halo) els.halo.style.stroke = pilot.color;
          if (els.arrow) els.arrow.style.fill = pilot.color;
          pilot._frameColor = pilot.color;
        }
        if (els.marker) {
          var markerTransform = "rotate(" + (routePoint.angle * 180) / Math.PI + ")";
          if (pilot._markerTransform !== markerTransform) {
            els.marker.setAttribute("transform", markerTransform);
            pilot._markerTransform = markerTransform;
          }
        }

        var labelLayoutKey = [labelSlot, label, pilot.color].join("|");
        if (pilot._labelLayoutKey !== labelLayoutKey) {
          // Fixed width so every label sits at exactly the same distance from the arrow.
          var vs = visualScale;
          var labelW = fieldScale * 0.064 * vs;
          var labelH = fieldScale * 0.022 * vs;
          var r = labelH * 0.40;
          var labelX = labelOffset.x - labelW / 2;
          var labelY = labelOffset.y - labelH / 2;
          var cy = labelOffset.y + fieldScale * 0.005 * vs;

          if (els.callsignBg) {
            var bgd;
            if (theme === "lcdr") {
              // LCDR: fully angular, no border-radius at all
              bgd = roundedRectPath(labelX, labelY, labelW, labelH, 0, 0, 0, 0);
              els.callsignBg.style.fill = pilot.color;
              els.callsignBg.style.stroke = "none";
            } else if (theme === "apex") {
              // Glassmorphism: dark fill, full pilot-color border
              bgd = roundedRectPath(labelX, labelY, labelW, labelH, r, r, r, r);
              els.callsignBg.style.fill = "var(--trackdraw-pilot-label-bg, rgb(0 0 0 / 88%))";
              els.callsignBg.style.stroke = pilot.color;
              els.callsignBg.style.strokeWidth = String(fieldScale * 0.003 * vs);
            } else {
              // DDS: top-left + bottom-right rounded (diagonal, matching DDS popup style)
              bgd = roundedRectPath(labelX, labelY, labelW, labelH, r, 0, r, 0);
              els.callsignBg.style.fill = pilot.color;
              els.callsignBg.style.stroke = "none";
            }
            els.callsignBg.setAttribute("d", bgd);
          }
          if (els.callsignText) {
            els.callsignText.setAttribute("x", labelX + labelW / 2);
            els.callsignText.setAttribute("y", cy);
            els.callsignText.setAttribute("text-anchor", "middle");
            els.callsignText.style.fill = theme === "apex"
              ? "var(--trackdraw-text, #fff)"
              : getContrastColor(pilot.color);
            els.callsignText.textContent = label;
          }

          pilot._labelLayoutKey = labelLayoutKey;
        }
      });
    }
    window.requestAnimationFrame(animationTick);
  }

  // ----------------------------------------------------------------
  // Socket event handlers
  // ----------------------------------------------------------------

  function handleHeat(msg) {
    if (!msg || !msg.heatNodes) return;

    pilots = {};
    prevLapCounts = {};
    prevSplitCounts = {};
    clearPilotEls();

    Object.keys(msg.heatNodes).forEach(function (key) {
      var index = parseInt(key, 10);
      var node = msg.heatNodes[key];
      if (!node || !node.callsign) return;

      var startNext = getNextAnchor(anchorModel.startFinishProgress);
      pilots[String(index)] = {
        nodeIndex: index,
        callsign: node.callsign,
        color: toHexColor(node.activeColor),
        active: true,
        lapCount: 0,
        position: null,
        lastAnchorProgress: anchorModel.startFinishProgress,
        lastAnchorKey: anchorModel.startFinishKey,
        nextAnchorProgress: startNext.progress,
        nextAnchorKey: startNext.key,
        lastAnchorTime: null,
        lastTimingAt: null,
        expectedSegmentMs: getBaselineLapMs(),
        expectedSegmentMsByKey: {},
        expectedLapMs: getBaselineLapMs(),
        hasLearnedPace: false,
        confidence: "idle",
        lastSeenAt: null,
        correctionStartTime: null,
        correctionEndTime: null,
      };
    });
  }

  function freezePilots(confidence) {
    Object.keys(pilots).forEach(function (nodeIdx) {
      var pilot = pilots[nodeIdx];
      var progress = getCurrentPilotProgress(pilot);
      var next = getNextAnchor(progress);
      pilot.lastAnchorProgress = progress;
      pilot.lastAnchorKey = getAnchorKeyForProgress(progress);
      pilot.nextAnchorProgress = next.progress;
      pilot.nextAnchorKey = next.key;
      pilot.lastAnchorTime = null;
      pilot.confidence = confidence || "idle";
      pilot.correctionStartTime = null;
      pilot.correctionEndTime = null;
    });
  }

  function handleRaceStatus(msg) {
    var status = msg && msg.race_status;
    var wasRunning = raceRunning;
    raceRunning = status === 1;

    if (status === 1 && !wasRunning) {
      // Race started: park every pilot at start/finish. Movement begins only
      // after RotorHazard confirms the first crossing/holeshot in current_laps.
      var startNext = getNextAnchor(anchorModel.startFinishProgress);
      Object.keys(pilots).forEach(function (nodeIdx) {
        var pilot = pilots[nodeIdx];
        pilot.lastAnchorProgress = anchorModel.startFinishProgress;
        pilot.lastAnchorKey = anchorModel.startFinishKey;
        pilot.nextAnchorProgress = startNext.progress;
        pilot.nextAnchorKey = startNext.key;
        pilot.expectedSegmentMs = getExpectedSegmentMs(
          pilot,
          pilot.lastAnchorProgress,
          pilot.nextAnchorProgress,
          pilot.lastAnchorKey,
          pilot.nextAnchorKey
        );
        pilot.lastAnchorTime = null;
        pilot.lastTimingAt = null;
        pilot.confidence = "idle";
        pilot.correctionStartTime = null;
        pilot.correctionEndTime = null;
      });
      prevLapCounts = {};
      prevSplitCounts = {};
    }

    if (status === 0 || status === 2) {
      // Race stopped or reset: freeze pilots where they are
      freezePilots("idle");
    }
  }

  function handleSocketConnect() {
    socketConnected = true;
    // Retry only if track never loaded and no fetch is already in flight.
    if (trackData === null && !trackLoadPending) {
      loadTrack();
    } else {
      // Unfreeze stale pilots — new socket data will place them correctly.
      Object.keys(pilots).forEach(function (k) {
        pilots[k].confidence = "idle";
      });
    }
  }

  function handleSocketDisconnect() {
    socketConnected = false;
    freezePilots("stale");
  }

  function handleCurrentLaps(msg) {
    var nodeIndex = msg && msg.current && msg.current.node_index;
    if (!nodeIndex) return;

    Object.keys(nodeIndex).forEach(function (nodeIdx) {
      var nodeData = nodeIndex[nodeIdx];
      var pilot = pilots[nodeIdx];
      if (!pilot || !nodeData || !Array.isArray(nodeData.laps)) return;

      var laps = getActiveLaps(nodeData.laps);
      var prevCount = prevLapCounts[nodeIdx] || 0;

      if (laps.length > prevCount) {
        learnLapSamples(pilot, laps, prevCount);
        var latest = laps[laps.length - 1];
        var lapNumber = Number(latest.lap_number);

        if (lapNumber === 0) {
          // Holeshot/start confirmation. Do not learn full-lap pace from this:
          // RotorHazard lap 0 is not a completed racing lap.
          setPilotAnchor(pilot, anchorModel.startFinishProgress, {
            anchorKey: anchorModel.startFinishKey,
            confidence: pilot.hasLearnedPace ? "high" : "low",
          });
        } else if (lapNumber > 0) {
          setPilotAnchor(pilot, anchorModel.startFinishProgress, {
            anchorKey: anchorModel.startFinishKey,
            confidence: "high",
          });
          pilot.lapCount = lapNumber;
        }
      }

      // Check for new splits in the current lap (only if splits are configured)
      if (laps.length > 0 && Object.keys(splitProgressMap).length > 0) {
        var lapIdx = laps.length - 1;
        var currentLap = laps[lapIdx];
        var splits = currentLap.splits || [];
        var splitKey = nodeIdx + ":" + lapIdx;
        var prevSplitCount = prevSplitCounts[splitKey] || 0;

        for (var i = prevSplitCount; i < splits.length; i++) {
          var split = splits[i];
          var splitProgress = splitProgressMap[split.split_id];
          if (typeof splitProgress === "number") {
            setPilotAnchor(pilot, splitProgress, {
              anchorKey: "split:" + split.split_id,
              confidence: "high",
            });
          }
        }
        prevSplitCounts[splitKey] = splits.length;
      }

      prevLapCounts[nodeIdx] = laps.length;
    });
  }

  function handleLeaderboard(msg) {
    var race = msg && msg.current && msg.current.leaderboard;
    var primary = race && race.meta && race.meta.primary_leaderboard;
    var leaderboard = primary && race ? race[primary] : null;
    var entries = Array.isArray(leaderboard)
      ? leaderboard
      : leaderboard && typeof leaderboard === "object"
        ? Object.keys(leaderboard).map(function (k) { return leaderboard[k]; })
        : [];

    entries.forEach(function (entry) {
      if (!entry || entry.node == null) return;
      var pilot = pilots[String(entry.node)];
      if (!pilot) return;
      if (entry.position != null) pilot.position = entry.position;
      if (entry.callsign) pilot.callsign = entry.callsign;
    });
  }

  // ----------------------------------------------------------------
  // Track loading
  // ----------------------------------------------------------------

  function getTrackJsonUrl() {
    var path = window.location.pathname.replace(/\/+$/, "");
    return /\/map$/.test(path)
      ? path.replace(/\/map$/, "/track.json")
      : path + "/track.json";
  }

  function getReadinessMessage(payload) {
    var readiness =
      payload && payload.diagnostics && payload.diagnostics.readiness;
    if (!readiness || !readiness.summary) {
      return (payload && payload.error) || "TrackDraw setup is incomplete.";
    }
    var lines = [readiness.summary];
    (readiness.issues || []).slice(0, 4).forEach(function (issue) {
      var line = "- " + (issue.message || issue.type || "Readiness issue");
      if (issue.detail) line += " (" + issue.detail + ")";
      lines.push(line);
    });
    if (readiness.issue_count > 4) {
      lines.push("- " + (readiness.issue_count - 4) + " more issue(s)");
    }
    return lines.join("\n");
  }

  function registerSocketHandlers() {
    socket.on("connect", handleSocketConnect);
    socket.on("disconnect", handleSocketDisconnect);
    socket.on("current_heat", handleHeat);
    socket.on("race_status", handleRaceStatus);
    socket.on("current_laps", handleCurrentLaps);
    socket.on("leaderboard", handleLeaderboard);
  }

  function loadTrack() {
    if (trackLoadPending) return;
    trackLoadPending = true;
    var url = getTrackJsonUrl();
    showMessage("Loading TrackDraw map...");

    fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status + " from " + url);
        return r.json();
      })
      .then(function (payload) {
        trackLoadPending = false;
        if (!payload.ok || !payload.track) {
          showMessage(getReadinessMessage(payload));
          return;
        }

        trackData = payload.track;
        setBaselineLapMs(trackData);
        sampledPoints = (
          (trackData.route && trackData.route.sampled_points) ||
          (trackData.route && trackData.route.waypoints) ||
          []
        ).filter(hasPoint);
        var model = buildTrackModel(trackData.timing_markers);
        splitProgressMap = model.splitProgressMap;
        anchorModel = model.anchorModel;

        if (!renderTrack(trackData, payload.state)) return;

        if (!animationRunning) {
          animationRunning = true;
          window.requestAnimationFrame(animationTick);
        }
      })
      .catch(function (err) {
        trackLoadPending = false;
        showMessage(err && err.message ? err.message : "Could not load TrackDraw cache.");
      });
  }

  $(document).ready(function () {
    applyViewportClass();

    // ?labels=0 hides all pilot callsign labels (useful for clean screen captures).
    var params = new URLSearchParams(window.location.search);
    if (params.get("labels") === "0") {
      var root = getRoot();
      if (root) root.classList.add("is-labels-off");
    }

    window.addEventListener("resize", function () {
      applyViewportClass();
      if (svgEl && trackData && sampledPoints.length) {
        setSafeViewBox(trackData.field, sampledPoints, trackData);
      }
    });
    loadTrack();
    registerSocketHandlers();
  });
})(window, document);
