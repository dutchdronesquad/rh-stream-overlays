(function (window, document) {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var DEFAULT_LAP_MS = 30000;
  var STALE_WINDOW_MS = 8000;
  var EMA_ALPHA = 0.35;

  // Set in renderTrack from the actual track field diagonal (meters).
  // All SVG sizes are derived as fractions of this value so proportions
  // stay correct regardless of how large or small the physical course is.
  var fieldScale = 72;

  // ---- Track state ----
  var trackData = null;
  var sampledPoints = [];
  var splitProgressMap = {};  // split_index(number) -> route progress (0..1)

  // ---- Pilot state, keyed by nodeIndex as string ----
  var pilots = {};

  // ---- Previous snapshots for diffing current_laps ----
  var prevLapCounts = {};    // nodeIdx(str) -> number of laps
  var prevSplitCounts = {};  // "nodeIdx:lapArrayIdx" -> number of splits

  // ---- Race state ----
  var raceRunning = false;

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

  // ----------------------------------------------------------------
  // Route geometry
  // ----------------------------------------------------------------

  function progressToPoint(progress) {
    if (!sampledPoints.length || !trackData) return null;
    var field = trackData.field;
    var clamped = progress % 1.0;
    if (clamped < 0) clamped += 1.0;
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
    var routeW    = fieldScale * 0.005;
    var gateR     = fieldScale * 0.009;
    var gateFontZ = fieldScale * 0.026;
    var gateSwW   = fieldScale * 0.003;
    var timingSfR = fieldScale * 0.013;
    var timingR   = fieldScale * 0.010;
    var timingSwW = fieldScale * 0.003;
    var timingFontZ = fieldScale * 0.022;

    var padding = fieldScale * 0.06;
    clearSvg(svgEl);
    svgEl.setAttribute(
      "viewBox",
      [-padding, -padding, field.width + padding * 2, field.height + padding * 2].join(" ")
    );

    var routePath = createSvgElement("path", {
      class: "trackdraw-map__route",
      d: getRoutePath(field, points),
    });
    routePath.style.strokeWidth = String(routeW);
    svgEl.appendChild(routePath);

    (track.route_obstacles || []).forEach(function (obstacle) {
      if (!obstacle.route_position) return;
      var pt = getPoint(field, obstacle.route_position);
      var g = createSvgElement("g", {
        transform: "translate(" + pt.x + " " + pt.y + ")",
      });
      var dot = createSvgElement("circle", {
        class: "trackdraw-map__obstacle",
        r: gateR,
      });
      dot.style.strokeWidth = String(gateSwW);
      g.appendChild(dot);
      if (obstacle.route_number != null) {
        var lbl = createSvgElement("text", {
          class: "trackdraw-map__obstacle-label",
          dy: String(gateR * 0.6),
        });
        lbl.style.fontSize = gateFontZ + "px";
        lbl.style.strokeWidth = String(fieldScale * 0.010) + "px";
        lbl.textContent = String(obstacle.route_number);
        g.appendChild(lbl);
      }
      svgEl.appendChild(g);
    });

    (track.timing_markers || []).forEach(function (marker) {
      if (!marker.route_position) return;
      var pt = getPoint(field, marker.route_position);
      var isStartFinish = marker.role === "start_finish";
      var r = isStartFinish ? timingSfR : timingR;
      var circle = createSvgElement("circle", {
        class: "trackdraw-map__timing",
        cx: pt.x,
        cy: pt.y,
        r: r,
      });
      circle.style.strokeWidth = String(timingSwW);
      svgEl.appendChild(circle);
      var lbl = createSvgElement("text", {
        class: "trackdraw-map__timing-label",
        x: pt.x,
        y: pt.y - r * 1.8,
      });
      lbl.style.fontSize = timingFontZ + "px";
      lbl.style.strokeWidth = String(fieldScale * 0.009) + "px";
      lbl.textContent = isStartFinish ? "S/F" : marker.title;
      svgEl.appendChild(lbl);
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

    var pilotR = fieldScale * 0.013;
    var dot = createSvgElement("circle", {
      class: "trackdraw-map__pilot",
      r: pilotR,
    });
    dot.style.fill = pilot.color;
    dot.style.strokeWidth = String(fieldScale * 0.003);

    var lbl = createSvgElement("text", {
      class: "trackdraw-map__pilot-label",
    });
    lbl.style.fontSize = fieldScale * 0.020 + "px";
    lbl.style.strokeWidth = String(fieldScale * 0.007) + "px";
    lbl.textContent = (pilot.callsign || "").slice(0, 3);

    g.appendChild(dot);
    g.appendChild(lbl);
    pilotGroupEl.appendChild(g);
  }

  function clearPilotEls() {
    if (!pilotGroupEl) return;
    while (pilotGroupEl.firstChild) pilotGroupEl.removeChild(pilotGroupEl.firstChild);
  }

  function estimateProgress(pilot) {
    if (pilot.lastAnchorTime === null || !raceRunning) {
      return pilot.lastAnchorProgress;
    }
    var elapsed = window.performance.now() - pilot.lastAnchorTime;
    var lapMs = pilot.expectedLapMs || DEFAULT_LAP_MS;
    return (pilot.lastAnchorProgress + elapsed / lapMs) % 1.0;
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
    var lapMs = pilot.expectedLapMs || DEFAULT_LAP_MS;
    return elapsed > lapMs + getStaleWindowMs();
  }

  function animationTick() {
    if (svgEl && pilotGroupEl) {
      Object.keys(pilots).forEach(function (nodeIdx) {
        var pilot = pilots[nodeIdx];
        if (!pilot.active) return;

        ensurePilotEl(pilot);

        var g = document.getElementById("td-pilot-" + nodeIdx);
        if (!g) return;

        var progress = estimateProgress(pilot);
        var pt = progressToPoint(progress);
        if (!pt) return;

        var dot = g.querySelector("circle");
        var lbl = g.querySelector("text");
        var opacity = isPilotStale(pilot) ? "0.3" : "1";

        if (dot) {
          dot.setAttribute("cx", pt.x);
          dot.setAttribute("cy", pt.y);
          dot.setAttribute("opacity", opacity);
          dot.style.fill = pilot.color;
        }
        if (lbl) {
          lbl.setAttribute("x", pt.x);
          lbl.setAttribute("y", pt.y - fieldScale * 0.022);
          lbl.setAttribute("opacity", opacity);
          lbl.textContent = (pilot.callsign || "").slice(0, 3);
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
        lastAnchorProgress: 0,
        lastAnchorTime: null,  // frozen until holeshot is confirmed
        expectedLapMs: DEFAULT_LAP_MS,
      };
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
      // Race started: park all pilots at start/finish, frozen until holeshot.
      // Drones launch from start pads — we don't animate until the first gate
      // pass is confirmed, so the marker doesn't wander across the field.
      Object.keys(pilots).forEach(function (nodeIdx) {
        pilots[nodeIdx].lastAnchorProgress = 0;
        pilots[nodeIdx].lastAnchorTime = null;
        pilots[nodeIdx].expectedLapMs = DEFAULT_LAP_MS;
      });
      prevLapCounts = {};
      prevSplitCounts = {};
    }

    if (status === 0 || status === 2) {
      // Race stopped or reset: freeze pilots where they are
      Object.keys(pilots).forEach(function (nodeIdx) {
        pilots[nodeIdx].lastAnchorTime = null;
      });
    }
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

        if (latest.lap_number === 0) {
          // Holeshot: first gate pass after launch. The marker was frozen at
          // start/finish — now we activate it and use the holeshot time as
          // an initial lap-time estimate so the first lap looks believable.
          if (typeof latest.lap_raw === "number" && latest.lap_raw > 0) {
            pilot.expectedLapMs = latest.lap_raw;
          }
          pilot.lastAnchorProgress = 0;
          pilot.lastAnchorTime = window.performance.now();
        } else if (latest.lap_number > 0) {
          // Racing lap completed — snap back to S/F and update expected time
          // via exponential moving average so the estimate adapts to the
          // pilot's actual pace without being thrown off by a single outlier.
          if (typeof latest.lap_raw === "number" && latest.lap_raw > 0) {
            if (pilot.expectedLapMs === DEFAULT_LAP_MS) {
              pilot.expectedLapMs = latest.lap_raw;
            } else {
              pilot.expectedLapMs = Math.round(
                EMA_ALPHA * latest.lap_raw + (1 - EMA_ALPHA) * pilot.expectedLapMs
              );
            }
          }
          pilot.lastAnchorProgress = 0;
          pilot.lastAnchorTime = window.performance.now();
          pilot.lapCount = latest.lap_number;
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
            pilot.lastAnchorProgress = splitProgress;
            pilot.lastAnchorTime = window.performance.now();
          }
        }
        prevSplitCounts[splitKey] = splits.length;
      }

      prevLapCounts[nodeIdx] = laps.length;
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
    socket.on("current_heat", handleHeat);
    socket.on("race_status", handleRaceStatus);
    socket.on("current_laps", handleCurrentLaps);
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
    loadTrack();
    registerSocketHandlers();
  });
})(window, document);
