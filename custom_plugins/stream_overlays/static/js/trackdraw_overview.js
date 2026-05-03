(function (window, document) {
  "use strict";

  var pilots = {};
  var raceRunning = false;
  var socketConnected = true;

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

  function updateRaceStatus(label) {
    setText("trackdraw-overview-race-status", label);
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
      .map(function (nodeIdx) {
        return pilots[nodeIdx];
      })
      .filter(function (pilot) {
        return pilot && pilot.active;
      })
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

  function makeText(className, text) {
    var el = document.createElement("span");
    el.className = className;
    el.textContent = text;
    return el;
  }

  function render() {
    var leaderEl = document.getElementById("trackdraw-overview-leader");
    var listEl = document.getElementById("trackdraw-overview-leaderboard");
    var sortedPilots = getSortedPilots();
    var leader = sortedPilots[0];

    if (leaderEl) {
      leaderEl.textContent = leader ? getPilotLabel(leader) : "--";
    }
    if (!listEl) return;

    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

    sortedPilots.slice(0, 8).forEach(function (pilot, index) {
      var position = Number(pilot.position);
      var positionLabel = !isNaN(position) && position > 0 ? position : index + 1;
      var row = document.createElement("li");
      var color = document.createElement("span");

      row.className =
        "trackdraw-map__overview-leaderboard-row is-" + getConfidence(pilot);
      color.className = "trackdraw-map__overview-color";
      color.style.background = pilot.color;

      row.appendChild(makeText("trackdraw-map__overview-rank", positionLabel));
      row.appendChild(color);
      row.appendChild(makeText("trackdraw-map__overview-name", getPilotLabel(pilot)));
      row.appendChild(
        makeText("trackdraw-map__overview-node", "N" + (pilot.nodeIndex + 1))
      );
      listEl.appendChild(row);
    });
  }

  function handleHeat(msg) {
    if (!msg || !msg.heatNodes) return;
    pilots = {};

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
    updateRaceStatus(raceRunning ? "Live" : status === 2 ? "Ended" : "Idle");
    render();
  }

  function handleSocketConnect() {
    socketConnected = true;
    updateRaceStatus(raceRunning ? "Live" : "Idle");
    render();
  }

  function handleSocketDisconnect() {
    socketConnected = false;
    updateRaceStatus("Disconnected");
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
