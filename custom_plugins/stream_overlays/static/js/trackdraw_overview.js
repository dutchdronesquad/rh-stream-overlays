(function (window, document) {
  "use strict";

  var pilots = {};
  var raceRunning = false;
  var socketConnected = true;
  var prevPositions = {};  // nodeIdx → display position (1-based)
  var deltaTimers = {};    // nodeIdx → timeout id

  function toHexColor(colorval) {
    if (!colorval) return "#ffffff";
    if (typeof window.colorvalToHex === "function") {
      return window.colorvalToHex(colorval);
    }
    return "#" + colorval.toString(16).padStart(6, "0");
  }

  function getPilotLabel(pilot) {
    return (pilot.callsign || "N" + (pilot.nodeIndex + 1)).slice(0, 12).toUpperCase();
  }

  function getTrackJsonUrl() {
    var path = window.location.pathname.replace(/\/+$/, "");
    return /\/overview$/.test(path)
      ? path + "/track.json"
      : path.replace(/\/map$/, "/track.json");
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function updateTrackTitle() {
    fetch(getTrackJsonUrl(), { headers: { Accept: "application/json" }, cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("TrackDraw package unavailable.");
        return response.json();
      })
      .then(function (payload) {
        if (payload && payload.track && payload.track.title) {
          setText("trackdraw-overview-title", payload.track.title);
        }
      })
      .catch(function () {
        // The shared map renderer already owns setup/error messaging.
      });
  }

  function setRaceStatus(label, statusKey) {
    var el = document.getElementById("trackdraw-overview-race-status");
    if (!el) return;
    el.textContent = label;
    el.dataset.status = statusKey || "idle";
  }

  function getConfidence(pilot) {
    if (!socketConnected) return "stale";
    if (!raceRunning) return "idle";
    if (pilot && pilot.lastLapAt && window.performance.now() - pilot.lastLapAt < 2500) {
      return "high";
    }
    return "medium";
  }

  function getSortedPilots() {
    return Object.keys(pilots)
      .map(function (nodeIdx) { return pilots[nodeIdx]; })
      .filter(function (pilot) { return pilot && pilot.active; })
      .sort(function (a, b) {
        var posA = Number(a.position);
        var posB = Number(b.position);
        var hasA = !isNaN(posA) && posA > 0;
        var hasB = !isNaN(posB) && posB > 0;
        if (hasA && hasB && posA !== posB) return posA - posB;
        if (hasA !== hasB) return hasA ? -1 : 1;
        return Number(a.nodeIndex) - Number(b.nodeIndex);
      });
  }

  // Record top positions of existing rows before a DOM rebuild (for FLIP).
  function recordBeforePositions(listEl) {
    var before = {};
    if (!listEl) return before;
    Array.prototype.forEach.call(listEl.children, function (row) {
      var nodeIdx = row.dataset.nodeIdx;
      if (nodeIdx !== undefined) {
        before[nodeIdx] = row.getBoundingClientRect().top;
      }
    });
    return before;
  }

  // FLIP: animate rows from their old screen positions to their new ones.
  function animateFlip(listEl, beforePositions) {
    Array.prototype.forEach.call(listEl.children, function (row) {
      var nodeIdx = row.dataset.nodeIdx;
      if (nodeIdx === undefined || beforePositions[nodeIdx] === undefined) return;

      var delta = beforePositions[nodeIdx] - row.getBoundingClientRect().top;
      if (Math.abs(delta) < 2) return;

      row.style.transition = "none";
      row.style.transform = "translateY(" + delta + "px)";
      row.getBoundingClientRect(); // force reflow
      row.style.transition = "transform 450ms cubic-bezier(0.25, 0.46, 0.45, 0.94)";
      row.style.transform = "";
    });
  }

  // Compare current sorted order to prevPositions to find movers.
  function computeDeltas(sortedPilots) {
    var deltas = {};
    sortedPilots.forEach(function (pilot, index) {
      var nodeIdx = String(pilot.nodeIndex);
      var newPos = index + 1;
      var oldPos = prevPositions[nodeIdx];
      if (oldPos !== undefined && oldPos !== newPos) {
        deltas[nodeIdx] = oldPos > newPos ? "up" : "down";
      }
    });
    return deltas;
  }

  function clearDeltaOnRow(listEl, nodeIdx) {
    if (!listEl) return;
    var row = listEl.querySelector('[data-node-idx="' + nodeIdx + '"]');
    if (!row) return;
    var el = row.querySelector(".trackdraw-map__overview-delta");
    if (el) {
      el.className = "trackdraw-map__overview-delta";
      el.textContent = "";
    }
  }

  function render() {
    var leaderEl = document.getElementById("trackdraw-overview-leader");
    var listEl = document.getElementById("trackdraw-overview-leaderboard");
    var sortedPilots = getSortedPilots();
    var leader = sortedPilots[0];

    // Animate leader name when it changes.
    if (leaderEl) {
      var newLabel = leader ? getPilotLabel(leader) : "--";
      if (leaderEl.textContent !== newLabel) {
        leaderEl.textContent = newLabel;
        leaderEl.classList.remove("is-changing");
        leaderEl.getBoundingClientRect(); // force reflow to restart animation
        leaderEl.classList.add("is-changing");
      }
    }

    if (!listEl) return;

    var deltas = computeDeltas(sortedPilots);
    var beforePositions = recordBeforePositions(listEl);

    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

    sortedPilots.slice(0, 8).forEach(function (pilot, index) {
      var nodeIdx = String(pilot.nodeIndex);
      var position = Number(pilot.position);
      var posLabel = !isNaN(position) && position > 0 ? position : index + 1;
      var isP1 = posLabel === 1;
      var confidence = getConfidence(pilot);
      var delta = deltas[nodeIdx];

      var row = document.createElement("li");
      row.className = "trackdraw-map__overview-row is-" + confidence +
        (isP1 ? " trackdraw-map__overview-row--p1" : "");
      row.dataset.nodeIdx = nodeIdx;

      var pos = document.createElement("span");
      pos.className = "trackdraw-map__overview-pos";
      pos.textContent = posLabel;

      var swatch = document.createElement("span");
      swatch.className = "trackdraw-map__overview-swatch";
      swatch.style.background = pilot.color;

      var callsign = document.createElement("span");
      callsign.className = "trackdraw-map__overview-callsign";
      callsign.textContent = getPilotLabel(pilot);

      var deltaEl = document.createElement("span");
      deltaEl.className = "trackdraw-map__overview-delta";
      if (delta) {
        if (deltaTimers[nodeIdx]) {
          clearTimeout(deltaTimers[nodeIdx]);
          delete deltaTimers[nodeIdx];
        }
        deltaEl.classList.add("is-" + delta);
        deltaEl.textContent = delta === "up" ? "▲" : "▼";
        deltaTimers[nodeIdx] = setTimeout(function () {
          clearDeltaOnRow(listEl, nodeIdx);
          delete deltaTimers[nodeIdx];
        }, 3000);
      }

      row.appendChild(pos);
      row.appendChild(swatch);
      row.appendChild(callsign);
      row.appendChild(deltaEl);
      listEl.appendChild(row);
    });

    animateFlip(listEl, beforePositions);

    // Persist positions for next render cycle.
    sortedPilots.forEach(function (pilot, index) {
      prevPositions[String(pilot.nodeIndex)] = index + 1;
    });
  }

  function handleHeat(msg) {
    if (!msg || !msg.heatNodes) return;
    pilots = {};
    prevPositions = {};

    Object.keys(msg.heatNodes).forEach(function (key) {
      var index = parseInt(key, 10);
      var node = msg.heatNodes[key];
      if (!node || !node.callsign) return;
      pilots[String(index)] = {
        nodeIndex: index,
        callsign: node.callsign,
        color: toHexColor(node.activeColor),
        active: true,
        position: null,
        lastLapAt: null,
      };
    });
    render();
  }

  function handleRaceStatus(msg) {
    var status = msg && msg.race_status;
    raceRunning = status === 1;
    if (raceRunning) {
      setRaceStatus("Live", "live");
    } else if (status === 2) {
      setRaceStatus("Ended", "ended");
    } else {
      setRaceStatus("Idle", "idle");
    }
    render();
  }

  function handleSocketConnect() {
    socketConnected = true;
    setRaceStatus(raceRunning ? "Live" : "Idle", raceRunning ? "live" : "idle");
    render();
  }

  function handleSocketDisconnect() {
    socketConnected = false;
    setRaceStatus("Disconnected", "disconnected");
    render();
  }

  function handleCurrentLaps(msg) {
    var nodeIndex = msg && msg.current && msg.current.node_index;
    if (!nodeIndex) return;
    Object.keys(nodeIndex).forEach(function (nodeIdx) {
      var nodeData = nodeIndex[nodeIdx];
      var pilot = pilots[nodeIdx];
      if (!pilot || !nodeData || !Array.isArray(nodeData.laps)) return;
      pilot.lastLapAt = window.performance.now();
    });
    render();
  }

  function handleLeaderboard(msg) {
    var race = msg && msg.current && msg.current.leaderboard;
    var primary = race && race.meta && race.meta.primary_leaderboard;
    var leaderboard = primary && race ? race[primary] : null;
    var entries = Array.isArray(leaderboard)
      ? leaderboard
      : leaderboard && typeof leaderboard === "object"
        ? Object.keys(leaderboard).map(function (key) { return leaderboard[key]; })
        : [];

    entries.forEach(function (entry) {
      if (!entry || entry.node == null) return;
      var pilot = pilots[String(entry.node)];
      if (!pilot) return;
      if (entry.position != null) pilot.position = entry.position;
      if (entry.callsign) pilot.callsign = entry.callsign;
    });
    render();
  }

  $(document).ready(function () {
    updateTrackTitle();
    if (typeof socket === "undefined") return;

    socket.on("connect", handleSocketConnect);
    socket.on("disconnect", handleSocketDisconnect);
    socket.on("current_heat", handleHeat);
    socket.on("race_status", handleRaceStatus);
    socket.on("current_laps", handleCurrentLaps);
    socket.on("leaderboard", handleLeaderboard);
  });
})(window, document);
