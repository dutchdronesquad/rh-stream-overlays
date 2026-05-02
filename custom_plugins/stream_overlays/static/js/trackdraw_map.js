(function (window, document) {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var DEFAULT_LAP_MS = 30000;
  var STALE_WINDOW_MS = 8000;
  var EMA_ALPHA = 0.35;
  var CONFIDENCE_HIGH_MS = 2500;
  var ANCHOR_CORRECTION_MS = 650;
  var CORRECTION_FADE_THRESHOLD_PROGRESS = 0.025;
  var LAP_ROLLOVER_CONTINUITY_PROGRESS = 0.08;
  var MIN_OBSERVED_SEGMENT_MS = 600;

  // Set in renderTrack from the actual track field diagonal (meters).
  // All SVG sizes are derived as fractions of this value so proportions
  // stay correct regardless of how large or small the physical course is.
  var fieldScale = 72;

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

  // ---- SVG elements ----
  var svgEl = null;
  var pilotGroupEl = null;

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
    return (
      field &&
      typeof field.width === "number" &&
      field.width > 0 &&
      typeof field.height === "number" &&
      field.height > 0
    );
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

  function buildSplitProgressMap(timingMarkers) {
    var map = {};
    if (!Array.isArray(timingMarkers)) return map;
    timingMarkers.forEach(function (marker) {
      if (
        marker &&
        marker.role === "split" &&
        typeof marker.split_index === "number" &&
        marker.route_position &&
        typeof marker.route_position.progress === "number"
      ) {
        map[marker.split_index] = marker.route_position.progress;
      }
    });
    return map;
  }

  function buildAnchorModel(timingMarkers) {
    var startFinishProgress = 0;
    var splits = [];

    if (Array.isArray(timingMarkers)) {
      timingMarkers.forEach(function (marker) {
        if (
          !marker ||
          !marker.route_position ||
          typeof marker.route_position.progress !== "number"
        ) {
          return;
        }

        if (marker.role === "start_finish") {
          startFinishProgress = normalizeProgress(marker.route_position.progress);
        }

        if (
          marker.role === "split" &&
          typeof marker.split_index === "number" &&
          !isNaN(marker.split_index)
        ) {
          splits.push({
            key: "split:" + marker.split_index,
            splitIndex: marker.split_index,
            progress: normalizeProgress(marker.route_position.progress),
            title: marker.title || "Split " + (marker.split_index + 1),
          });
        }
      });
    }

    splits.sort(function (a, b) {
      return (
        forwardDelta(startFinishProgress, a.progress) -
        forwardDelta(startFinishProgress, b.progress)
      );
    });

    return {
      startFinishProgress: startFinishProgress,
      startFinishKey: "sf",
      orderedSplits: splits,
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

  function getNextAnchorProgress(progress) {
    return getNextAnchor(progress).progress;
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

    var lapMs = pilot.expectedLapMs || DEFAULT_LAP_MS;
    var share = getSegmentShare(fromProgress, toProgress, fromKey, toKey);
    return Math.max(1200, Math.round(lapMs * share));
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

  // ----------------------------------------------------------------
  // UI helpers
  // ----------------------------------------------------------------

  function showMessage(text, status) {
    var msgEl = document.getElementById("trackdraw-map-message");
    var statusEl = document.getElementById("trackdraw-cache-status");
    if (statusEl) statusEl.textContent = status || "Setup";
    if (msgEl) {
      msgEl.textContent = text || "TrackDraw map is not ready.";
      msgEl.classList.add("is-visible");
    }
  }

  function hideMessage(status) {
    var msgEl = document.getElementById("trackdraw-map-message");
    var statusEl = document.getElementById("trackdraw-cache-status");
    if (statusEl) statusEl.textContent = status || "Ready";
    if (msgEl) msgEl.classList.remove("is-visible");
  }

  function clearSvg(svg) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  function applyViewportClass() {
    var root = document.querySelector(".trackdraw-map");
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
    var root = document.querySelector(".trackdraw-map");
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

  function renderTrack(track, cacheState) {
    svgEl = document.getElementById("trackdraw-map-svg");
    if (!svgEl) {
      showMessage("SVG mount missing.", "Error");
      return false;
    }
    if (!track || !track.route || !hasValidField(track.field)) {
      showMessage("No ready TrackDraw route.", "Blocked");
      return false;
    }
    if (!track.readiness || track.readiness.status !== "ready") {
      showMessage("TrackDraw setup is blocked.", "Blocked");
      return false;
    }

    var field = track.field;
    var points = (track.route.sampled_points || track.route.waypoints || []).filter(hasPoint);
    if (points.length <= 1) {
      showMessage("Route has no drawable points.", "Blocked");
      return false;
    }

    // Derive proportional sizes from the field diagonal so elements look
    // correct at any physical track scale (small club field or large venue).
    fieldScale = Math.sqrt(field.width * field.width + field.height * field.height);
    var routeShadowW = fieldScale * 0.016;
    var routeOuterW = fieldScale * 0.010;
    var routeInnerW = fieldScale * 0.006;
    var gateR = fieldScale * 0.006;
    var gateCoreR = fieldScale * 0.0027;
    var gateSwW = fieldScale * 0.0017;
    var timingSfR = fieldScale * 0.013;
    var timingR   = fieldScale * 0.010;
    var timingSwW = fieldScale * 0.003;
    var timingFontZ = fieldScale * 0.022;

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
          : "trackdraw-map__timing-tick",
        x1: pt.x - Math.cos(normal) * tickSize,
        y1: pt.y - Math.sin(normal) * tickSize,
        x2: pt.x + Math.cos(normal) * tickSize,
        y2: pt.y + Math.sin(normal) * tickSize,
      });
      tick.style.strokeWidth = String(isStartFinish ? timingSwW * 2 : timingSwW);
      svgEl.appendChild(tick);

      if (isStartFinish) {
        var startGate = createSvgElement("g", {
          class: "trackdraw-map__start-gate",
          transform:
            "translate(" +
            pt.x +
            " " +
            pt.y +
            ") rotate(" +
            (angle * 180) / Math.PI +
            ")",
        });
        [-1, 1].forEach(function (side) {
          var cap = createSvgElement("rect", {
            class: "trackdraw-map__start-gate-cap",
            x: -r * 0.75,
            y: side * tickSize - r * 0.34,
            width: r * 1.5,
            height: r * 0.68,
            rx: r * 0.12,
          });
          startGate.appendChild(cap);
        });
        svgEl.appendChild(startGate);

        var badge = createSvgElement("g", {
          class: "trackdraw-map__start-badge",
          transform: "translate(" + pt.x + " " + (pt.y - r * 3.2) + ")",
        });
        var badgeRect = createSvgElement("rect", {
          x: -r * 2.1,
          y: -r * 0.95,
          width: r * 4.2,
          height: r * 1.9,
          rx: r * 0.25,
        });
        var badgeText = createSvgElement("text", {
          dy: r * 0.38,
          class: "trackdraw-map__start-badge-text",
        });
        badgeText.style.fontSize = timingFontZ + "px";
        badgeText.style.strokeWidth = String(fieldScale * 0.006) + "px";
        badgeText.textContent = "S/F";
        badge.appendChild(badgeRect);
        badge.appendChild(badgeText);
        svgEl.appendChild(badge);
        return;
      }

    });

    // Show the actual track title in the header badge
    var headerLabel = document.querySelector(".trackdraw-map__label");
    if (headerLabel && track.title) {
      headerLabel.textContent = track.title;
    }

    // Pilot group always rendered on top
    pilotGroupEl = createSvgElement("g", { class: "trackdraw-map__pilots" });
    svgEl.appendChild(pilotGroupEl);

    hideMessage(cacheState === "stale" ? "Stale cache" : "Ready");
    return true;
  }

  // ----------------------------------------------------------------
  // Pilot rendering (dynamic layer)
  // ----------------------------------------------------------------

  function ensurePilotEl(pilot) {
    var id = "td-pilot-" + pilot.nodeIndex;
    if (document.getElementById(id)) return;
    if (!pilotGroupEl) return;

    var g = createSvgElement("g", { id: id, class: "trackdraw-map__pilot-group" });

    var pilotR = fieldScale * 0.010;
    var halo = createSvgElement("circle", {
      class: "trackdraw-map__pilot-halo",
      r: pilotR * 1.9,
    });
    halo.style.strokeWidth = String(fieldScale * 0.0032);

    var marker = createSvgElement("g", {
      class: "trackdraw-map__pilot-marker",
    });
    var arrowLen = fieldScale * 0.019;
    var arrowW = fieldScale * 0.009;
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
    arrow.style.strokeWidth = String(fieldScale * 0.0023);
    marker.appendChild(arrow);

    var connector = createSvgElement("line", {
      class: "trackdraw-map__pilot-label-connector",
    });
    connector.style.strokeWidth = String(fieldScale * 0.0015);

    var labelBg = createSvgElement("rect", {
      class: "trackdraw-map__pilot-label-bg",
      rx: fieldScale * 0.006,
    });
    labelBg.style.strokeWidth = String(fieldScale * 0.002);

    var labelAccent = createSvgElement("rect", {
      class: "trackdraw-map__pilot-label-accent",
      rx: fieldScale * 0.002,
    });

    var positionBg = createSvgElement("rect", {
      class: "trackdraw-map__pilot-position-bg",
      rx: fieldScale * 0.004,
    });

    var positionText = createSvgElement("text", {
      class: "trackdraw-map__pilot-position",
    });
    positionText.style.fontSize = fieldScale * 0.013 + "px";

    var lbl = createSvgElement("text", {
      class: "trackdraw-map__pilot-label",
    });
    lbl.style.fontSize = fieldScale * 0.0165 + "px";
    lbl.textContent = getPilotLabel(pilot);

    g.appendChild(halo);
    g.appendChild(marker);
    g.appendChild(connector);
    g.appendChild(labelBg);
    g.appendChild(labelAccent);
    g.appendChild(positionBg);
    g.appendChild(positionText);
    g.appendChild(lbl);
    pilotGroupEl.appendChild(g);
  }

  function clearPilotEls() {
    if (!pilotGroupEl) return;
    while (pilotGroupEl.firstChild) pilotGroupEl.removeChild(pilotGroupEl.firstChild);
  }

  function getPilotLabel(pilot) {
    return (pilot.callsign || "N" + (pilot.nodeIndex + 1)).slice(0, 4).toUpperCase();
  }

  function getLabelSlot(pilot) {
    var index = Number(pilot.nodeIndex);
    return isNaN(index) ? 0 : Math.abs(index) % 6;
  }

  function getLabelOffset(slot) {
    var offsets = [
      { x: 0, y: -0.036 },
      { x: 0.036, y: -0.042 },
      { x: -0.036, y: -0.042 },
      { x: 0.052, y: -0.028 },
      { x: -0.052, y: -0.028 },
      { x: 0, y: -0.056 },
    ];
    var offset = offsets[slot] || offsets[0];
    return {
      x: fieldScale * offset.x,
      y: fieldScale * offset.y,
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

    if (
      opts.rollover === true &&
      segmentShare > 0 &&
      progressFromAnchor > 0 &&
      progressFromAnchor < Math.min(LAP_ROLLOVER_CONTINUITY_PROGRESS, segmentShare * 0.6)
    ) {
      carriedElapsedMs = Math.round(segmentMs * (progressFromAnchor / segmentShare));
    }

    var shouldFadeCorrection =
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
    var segmentMs = pilot.expectedSegmentMs || pilot.expectedLapMs || DEFAULT_LAP_MS;
    return interpolateProgress(
      pilot.lastAnchorProgress,
      pilot.nextAnchorProgress,
      elapsed / segmentMs,
      pilot.lastAnchorKey,
      pilot.nextAnchorKey
    );
  }

  function estimateProgress(pilot) {
    if (pilot.lastAnchorTime === null || !raceRunning || !socketConnected) {
      return pilot.lastAnchorProgress;
    }
    return getCurrentPilotProgress(pilot);
  }

  function getStaleWindowMs() {
    // Use the operator-configured minimum lap time when available; it is the
    // right tolerance: if a pilot hasn't been seen for expectedLap + minLap,
    // something is genuinely wrong. rotorhazard.min_lap is in seconds.
    if (
      typeof rotorhazard !== "undefined" &&
      typeof rotorhazard.min_lap === "number" &&
      rotorhazard.min_lap > 0
    ) {
      return rotorhazard.min_lap * 1000;
    }
    return STALE_WINDOW_MS;
  }

  function isPilotStale(pilot) {
    if (pilot.lastAnchorTime === null || !raceRunning) return false;
    var elapsed = window.performance.now() - pilot.lastAnchorTime;
    var segmentMs = pilot.expectedSegmentMs || pilot.expectedLapMs || DEFAULT_LAP_MS;
    return elapsed > segmentMs + getStaleWindowMs();
  }

  function getPilotConfidence(pilot) {
    if (!socketConnected && raceRunning) return "stale";
    if (isPilotStale(pilot)) return "stale";
    if (!raceRunning || pilot.lastAnchorTime === null) return "idle";
    if (pilot.confidence === "low") return "low";

    var elapsed = window.performance.now() - pilot.lastAnchorTime;
    var segmentMs = pilot.expectedSegmentMs || pilot.expectedLapMs || DEFAULT_LAP_MS;
    if (elapsed < CONFIDENCE_HIGH_MS) return "high";
    if (elapsed > segmentMs * 0.85) return "low";
    return "medium";
  }

  function getLapTimeMs(lap) {
    if (!lap) return null;
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

  function updateExpectedLapMs(pilot, lapMs) {
    if (typeof lapMs !== "number" || lapMs <= 0) return;
    if (
      typeof rotorhazard !== "undefined" &&
      typeof rotorhazard.min_lap === "number" &&
      rotorhazard.min_lap > 0 &&
      lapMs < rotorhazard.min_lap * 1000
    ) {
      return;
    }

    if (pilot.expectedLapMs === DEFAULT_LAP_MS || pilot.hasLearnedPace !== true) {
      pilot.expectedLapMs = lapMs;
    } else {
      pilot.expectedLapMs = Math.round(
        EMA_ALPHA * lapMs + (1 - EMA_ALPHA) * pilot.expectedLapMs
      );
    }
    pilot.hasLearnedPace = true;
  }

  function animationTick() {
    if (svgEl && pilotGroupEl) {
      var activeNodeIndexes = Object.keys(pilots).filter(function (nodeIdx) {
        return pilots[nodeIdx] && pilots[nodeIdx].active;
      });
      updatePilotDensityClass(activeNodeIndexes.length);

      activeNodeIndexes.forEach(function (nodeIdx) {
        var pilot = pilots[nodeIdx];

        ensurePilotEl(pilot);

        var g = document.getElementById("td-pilot-" + nodeIdx);
        if (!g) return;

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
        g.setAttribute("class", groupClass);
        g.setAttribute("transform", "translate(" + pt.x + " " + pt.y + ")");
        if (isLeader && g.parentNode === pilotGroupEl) {
          pilotGroupEl.appendChild(g);
        }

        var halo = g.querySelector(".trackdraw-map__pilot-halo");
        var marker = g.querySelector(".trackdraw-map__pilot-marker");
        var arrow = g.querySelector(".trackdraw-map__pilot");
        var connector = g.querySelector(".trackdraw-map__pilot-label-connector");
        var labelBg = g.querySelector(".trackdraw-map__pilot-label-bg");
        var labelAccent = g.querySelector(".trackdraw-map__pilot-label-accent");
        var positionBg = g.querySelector(".trackdraw-map__pilot-position-bg");
        var positionText = g.querySelector(".trackdraw-map__pilot-position");
        var lbl = g.querySelector(".trackdraw-map__pilot-label");
        var label = getPilotLabel(pilot);

        if (halo) {
          halo.style.stroke = pilot.color;
        }
        if (marker) {
          marker.setAttribute(
            "transform",
            "rotate(" + (routePoint.angle * 180) / Math.PI + ")"
          );
        }
        if (arrow) {
          arrow.style.fill = pilot.color;
        }
        if (connector) {
          connector.setAttribute("x1", 0);
          connector.setAttribute("y1", -fieldScale * 0.011);
          connector.setAttribute("x2", labelOffset.x);
          connector.setAttribute("y2", labelOffset.y + fieldScale * 0.013);
          connector.style.stroke = pilot.color;
        }
        if (labelBg) {
          var accentW = fieldScale * 0.005;
          var posW = hasPosition ? fieldScale * 0.022 : 0;
          var gap = hasPosition ? fieldScale * 0.004 : 0;
          var labelW = Math.max(
            fieldScale * (hasPosition ? 0.066 : 0.046),
            fieldScale * (0.014 * String(label).length + 0.030) + posW + gap
          );
          var labelH = fieldScale * 0.030;
          var labelX = labelOffset.x - labelW / 2;
          var labelY = labelOffset.y - labelH / 2;
          labelBg.setAttribute("x", labelX);
          labelBg.setAttribute("y", labelY);
          labelBg.setAttribute("width", labelW);
          labelBg.setAttribute("height", labelH);
          labelBg.style.stroke = pilot.color;
          if (labelAccent) {
            labelAccent.setAttribute("x", labelX);
            labelAccent.setAttribute("y", labelY);
            labelAccent.setAttribute("width", accentW);
            labelAccent.setAttribute("height", labelH);
            labelAccent.style.fill = pilot.color;
          }
          if (positionBg && positionText) {
            if (hasPosition) {
              var posX = labelX + accentW + fieldScale * 0.004;
              positionBg.removeAttribute("display");
              positionText.removeAttribute("display");
              positionBg.setAttribute("x", posX);
              positionBg.setAttribute("y", labelY + fieldScale * 0.004);
              positionBg.setAttribute("width", posW);
              positionBg.setAttribute("height", labelH - fieldScale * 0.008);
              positionBg.style.fill = pilot.color;
              positionText.setAttribute("x", posX + posW / 2);
              positionText.setAttribute("y", labelOffset.y + fieldScale * 0.005);
              positionText.textContent = String(position);
            } else {
              positionBg.setAttribute("display", "none");
              positionText.setAttribute("display", "none");
            }
          }
          if (lbl) {
            var textAreaStart =
              labelX + accentW + fieldScale * 0.006 + (hasPosition ? posW + gap : 0);
            var textAreaW = labelW - (textAreaStart - labelX) - fieldScale * 0.008;
            lbl.setAttribute("x", textAreaStart + textAreaW / 2);
            lbl.setAttribute("y", labelOffset.y + fieldScale * 0.0055);
          }
        }
        if (lbl) {
          lbl.textContent = label;
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

      pilots[String(index)] = {
        nodeIndex: index,
        callsign: node.callsign,
        color: toHexColor(node.activeColor),
        active: true,
        lapCount: 0,
        position: null,
        lastAnchorProgress: anchorModel.startFinishProgress,
        lastAnchorKey: anchorModel.startFinishKey,
        nextAnchorProgress: getNextAnchorProgress(anchorModel.startFinishProgress),
        nextAnchorKey: getNextAnchor(anchorModel.startFinishProgress).key,
        lastAnchorTime: null,
        lastTimingAt: null,
        expectedSegmentMs: DEFAULT_LAP_MS,
        expectedSegmentMsByKey: {},
        expectedLapMs: DEFAULT_LAP_MS,
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
      pilots[nodeIdx].lastAnchorProgress = getCurrentPilotProgress(pilots[nodeIdx]);
      pilots[nodeIdx].lastAnchorKey = getAnchorKeyForProgress(
        pilots[nodeIdx].lastAnchorProgress
      );
      pilots[nodeIdx].nextAnchorProgress = getNextAnchorProgress(
        pilots[nodeIdx].lastAnchorProgress
      );
      pilots[nodeIdx].nextAnchorKey = getNextAnchor(
        pilots[nodeIdx].lastAnchorProgress
      ).key;
      pilots[nodeIdx].lastAnchorTime = null;
      pilots[nodeIdx].confidence = confidence || "idle";
      pilots[nodeIdx].correctionStartTime = null;
      pilots[nodeIdx].correctionEndTime = null;
    });
  }

  function handleRaceStatus(msg) {
    var status = msg && msg.race_status;
    var wasRunning = raceRunning;
    raceRunning = status === 1;

    // Live indicator dot in header badge
    var header = document.querySelector(".trackdraw-map__header");
    if (header) {
      if (raceRunning) {
        header.classList.add("is-live");
      } else {
        header.classList.remove("is-live");
      }
    }

    if (status === 1 && !wasRunning) {
      // Race started: park every pilot at start/finish. Movement begins only
      // after RotorHazard confirms the first crossing/holeshot in current_laps.
      Object.keys(pilots).forEach(function (nodeIdx) {
        var nextAnchor = getNextAnchor(anchorModel.startFinishProgress);
        pilots[nodeIdx].lastAnchorProgress = anchorModel.startFinishProgress;
        pilots[nodeIdx].lastAnchorKey = anchorModel.startFinishKey;
        pilots[nodeIdx].nextAnchorProgress = nextAnchor.progress;
        pilots[nodeIdx].nextAnchorKey = nextAnchor.key;
        pilots[nodeIdx].expectedSegmentMs = getExpectedSegmentMs(
          pilots[nodeIdx],
          pilots[nodeIdx].lastAnchorProgress,
          pilots[nodeIdx].nextAnchorProgress,
          pilots[nodeIdx].lastAnchorKey,
          pilots[nodeIdx].nextAnchorKey
        );
        pilots[nodeIdx].lastAnchorTime = null;
        pilots[nodeIdx].lastTimingAt = null;
        pilots[nodeIdx].confidence = "idle";
        pilots[nodeIdx].correctionStartTime = null;
        pilots[nodeIdx].correctionEndTime = null;
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

      var laps = nodeData.laps;
      var prevCount = prevLapCounts[nodeIdx] || 0;

      if (laps.length > prevCount) {
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
          // Racing lap completed — snap back to S/F and update expected time
          // via exponential moving average so the estimate adapts to the
          // pilot's actual pace without being thrown off by a single outlier.
          updateExpectedLapMs(pilot, getLapTimeMs(latest));
          setPilotAnchor(pilot, anchorModel.startFinishProgress, {
            anchorKey: anchorModel.startFinishKey,
            confidence: "high",
            rollover: true,
          });
          pilot.lapCount = lapNumber;
        }
      }

      // Check for new splits in the current lap (only if splits are configured)
      if (laps.length > 0 && Object.keys(splitProgressMap).length > 0) {
        var lapIdx = laps.length - 1;
        var latest = laps[lapIdx];
        var splits = latest.splits || [];
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

  function objectValues(value) {
    if (!value || typeof value !== "object") return [];
    return Object.keys(value).map(function (key) {
      return value[key];
    });
  }

  function handleLeaderboard(msg) {
    var race = msg && msg.current && msg.current.leaderboard;
    var primary = race && race.meta && race.meta.primary_leaderboard;
    var leaderboard = primary && race ? race[primary] : null;
    var entries = Array.isArray(leaderboard) ? leaderboard : objectValues(leaderboard);

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
    var url = getTrackJsonUrl();
    showMessage("Loading TrackDraw map...", "Loading");

    fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status + " from " + url);
        return r.json();
      })
      .then(function (payload) {
        if (!payload.ok || !payload.track) {
          showMessage(getReadinessMessage(payload), payload.state || "Error");
          return;
        }

        trackData = payload.track;
        sampledPoints = (
          (trackData.route && trackData.route.sampled_points) ||
          (trackData.route && trackData.route.waypoints) ||
          []
        ).filter(hasPoint);
        splitProgressMap = buildSplitProgressMap(trackData.timing_markers);
        anchorModel = buildAnchorModel(trackData.timing_markers);

        if (!renderTrack(trackData, payload.state)) return;

        window.requestAnimationFrame(animationTick);
      })
      .catch(function (err) {
        showMessage(
          err && err.message ? err.message : "Could not load TrackDraw cache.",
          "Error"
        );
      });
  }

  $(document).ready(function () {
    applyViewportClass();
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
