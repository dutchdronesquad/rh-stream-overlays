(function (window, document) {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var DEFAULT_LAP_MS = 30000;
  var STALE_WINDOW_MS = 8000;

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

    var padding = Math.max(field.width, field.height) * 0.08;
    clearSvg(svgEl);
    svgEl.setAttribute(
      "viewBox",
      [-padding, -padding, field.width + padding * 2, field.height + padding * 2].join(" ")
    );

    svgEl.appendChild(
      createSvgElement("rect", {
        class: "trackdraw-map__field",
        x: 0,
        y: 0,
        width: field.width,
        height: field.height,
      })
    );

    svgEl.appendChild(
      createSvgElement("path", {
        class: "trackdraw-map__route",
        d: getRoutePath(field, points),
      })
    );

    (track.route_obstacles || []).forEach(function (obstacle) {
      if (!obstacle.route_position) return;
      var pt = getPoint(field, obstacle.route_position);
      var g = createSvgElement("g", {
        transform: "translate(" + pt.x + " " + pt.y + ")",
      });
      g.appendChild(
        createSvgElement("circle", {
          class: "trackdraw-map__obstacle",
          r: 1.45,
        })
      );
      if (obstacle.route_number != null) {
        var lbl = createSvgElement("text", {
          class: "trackdraw-map__obstacle-label",
          dy: "0.92",
        });
        lbl.textContent = String(obstacle.route_number);
        g.appendChild(lbl);
      }
      svgEl.appendChild(g);
    });

    (track.timing_markers || []).forEach(function (marker) {
      if (!marker.route_position) return;
      var pt = getPoint(field, marker.route_position);
      svgEl.appendChild(
        createSvgElement("circle", {
          class: "trackdraw-map__timing",
          cx: pt.x,
          cy: pt.y,
          r: marker.role === "start_finish" ? 1.25 : 0.95,
        })
      );
      var lbl = createSvgElement("text", {
        class: "trackdraw-map__timing-label",
        x: pt.x,
        y: pt.y - 2.15,
      });
      lbl.textContent = marker.role === "start_finish" ? "S/F" : marker.title;
      svgEl.appendChild(lbl);
    });

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

    var dot = createSvgElement("circle", {
      class: "trackdraw-map__pilot",
      r: 2.0,
    });
    dot.style.fill = pilot.color;

    var lbl = createSvgElement("text", {
      class: "trackdraw-map__pilot-label",
    });
    lbl.textContent = (pilot.callsign || "").slice(0, 4);

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
          lbl.setAttribute("y", pt.y - 2.8);
          lbl.setAttribute("opacity", opacity);
          lbl.textContent = (pilot.callsign || "").slice(0, 4);
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

    msg.heatNodes.forEach(function (node, index) {
      if (!node || !node.callsign) return;

      pilots[String(index)] = {
        nodeIndex: index,
        callsign: node.callsign,
        color: toHexColor(node.activeColor),
        active: true,
        lapCount: 0,
        lastAnchorProgress: 0,
        lastAnchorTime: raceRunning ? window.performance.now() : null,
        expectedLapMs: DEFAULT_LAP_MS,
      };
    });
  }

  function handleRaceStatus(msg) {
    var status = msg && msg.race_status;
    var wasRunning = raceRunning;
    raceRunning = status === 1;

    if (status === 1 && !wasRunning) {
      // Race just started: place all pilots at start/finish
      Object.keys(pilots).forEach(function (nodeIdx) {
        pilots[nodeIdx].lastAnchorProgress = 0;
        pilots[nodeIdx].lastAnchorTime = window.performance.now();
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

        // Update expected lap time from real data (skip lap_number 0 = holeshot)
        if (latest.lap_number > 0 && typeof latest.lap_raw === "number" && latest.lap_raw > 0) {
          pilot.expectedLapMs = latest.lap_raw;
        }

        // Snap pilot back to start/finish
        pilot.lastAnchorProgress = 0;
        pilot.lastAnchorTime = window.performance.now();
        pilot.lapCount = latest.lap_number || laps.length;
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
