(function (window, document) {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";

  function createSvgElement(name, attrs) {
    var element = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (key) {
      element.setAttribute(key, String(attrs[key]));
    });
    return element;
  }

  function getPoint(field, point) {
    var y = point.y;
    if (field.origin === "bl") {
      y = field.height - point.y;
    }
    return { x: point.x, y: y };
  }

  function getRoutePath(field, points) {
    return points
      .map(function (point, index) {
        var next = getPoint(field, point);
        return (index === 0 ? "M " : "L ") + next.x + " " + next.y;
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

  function hasPoint(point) {
    return (
      point &&
      typeof point.x === "number" &&
      typeof point.y === "number"
    );
  }

  function getTrackJsonUrl() {
    var path = window.location.pathname.replace(/\/+$/, "");
    if (/\/minimap$/.test(path)) {
      return path.replace(/\/minimap$/, "/track.json");
    }
    return path + "/track.json";
  }

  function clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function renderSetupState(message, statusText) {
    var messageElement = document.getElementById("trackdraw-minimap-message");
    var statusElement = document.getElementById("trackdraw-cache-status");

    if (statusElement) {
      statusElement.textContent = statusText || "Setup";
    }
    if (messageElement) {
      messageElement.textContent = message || "TrackDraw minimap is not ready.";
      messageElement.classList.add("is-visible");
    }
  }

  function getReadinessMessage(payload) {
    var readiness =
      payload &&
      payload.diagnostics &&
      payload.diagnostics.readiness &&
      typeof payload.diagnostics.readiness === "object"
        ? payload.diagnostics.readiness
        : null;

    if (!readiness || !readiness.summary) {
      return (payload && payload.error) || "TrackDraw setup is incomplete.";
    }

    var lines = [readiness.summary];
    (readiness.issues || []).slice(0, 4).forEach(function (issue) {
      var line = "- " + (issue.message || issue.type || "Readiness issue");
      if (issue.detail) {
        line += " (" + issue.detail + ")";
      }
      lines.push(line);
    });

    if (readiness.issue_count > 4) {
      lines.push("- " + (readiness.issue_count - 4) + " more issue(s)");
    }

    return lines.join("\n");
  }

  function hideSetupState(statusText) {
    var messageElement = document.getElementById("trackdraw-minimap-message");
    var statusElement = document.getElementById("trackdraw-cache-status");

    if (statusElement) {
      statusElement.textContent = statusText;
    }
    if (messageElement) {
      messageElement.classList.remove("is-visible");
    }
  }

  function renderObstacle(svg, field, obstacle) {
    if (!obstacle.route_position) {
      return;
    }

    var point = getPoint(field, obstacle.route_position);
    var group = createSvgElement("g", {
      transform: "translate(" + point.x + " " + point.y + ")",
    });
    group.appendChild(
      createSvgElement("circle", {
        class: "trackdraw-minimap__obstacle",
        r: 1.45,
      })
    );

    if (obstacle.route_number !== null && obstacle.route_number !== undefined) {
      var label = createSvgElement("text", {
        class: "trackdraw-minimap__obstacle-label",
        dy: "0.92",
      });
      label.textContent = String(obstacle.route_number);
      group.appendChild(label);
    }

    svg.appendChild(group);
  }

  function renderTimingMarker(svg, field, marker) {
    if (!marker.route_position) {
      return;
    }

    var point = getPoint(field, marker.route_position);
    svg.appendChild(
      createSvgElement("circle", {
        class: "trackdraw-minimap__timing",
        cx: point.x,
        cy: point.y,
        r: marker.role === "start_finish" ? 1.25 : 0.95,
      })
    );

    var label = createSvgElement("text", {
      class: "trackdraw-minimap__timing-label",
      x: point.x,
      y: point.y - 2.15,
    });
    label.textContent = marker.role === "start_finish" ? "S/F" : marker.title;
    svg.appendChild(label);
  }

  function renderTrack(track, cacheState) {
    var svg = document.getElementById("trackdraw-minimap-svg");
    if (!svg) {
      renderSetupState("TrackDraw minimap SVG mount is missing.", "Error");
      return;
    }

    if (!track || !track.route || !hasValidField(track.field)) {
      renderSetupState("No ready TrackDraw route and field found.", "Blocked");
      return;
    }

    if (!track.readiness || track.readiness.status !== "ready") {
      renderSetupState("TrackDraw route setup is blocked.", "Blocked");
      return;
    }

    var field = track.field;
    var padding = Math.max(field.width, field.height) * 0.04;
    var viewX = -padding;
    var viewY = -padding;
    var viewWidth = field.width + padding * 2;
    var viewHeight = field.height + padding * 2;
    var points = (track.route.sampled_points || track.route.waypoints || []).filter(
      hasPoint
    );

    clearElement(svg);
    svg.setAttribute("viewBox", [viewX, viewY, viewWidth, viewHeight].join(" "));

    svg.appendChild(
      createSvgElement("rect", {
        class: "trackdraw-minimap__field",
        x: 0,
        y: 0,
        width: field.width,
        height: field.height,
      })
    );

    if (points.length <= 1) {
      renderSetupState("TrackDraw route has no drawable sampled points.", "Blocked");
      return;
    }

    svg.appendChild(
      createSvgElement("path", {
        class: "trackdraw-minimap__route",
        d: getRoutePath(field, points),
      })
    );

    (track.route_obstacles || []).forEach(function (obstacle) {
      renderObstacle(svg, field, obstacle);
    });

    (track.timing_markers || []).forEach(function (marker) {
      renderTimingMarker(svg, field, marker);
    });

    hideSetupState(cacheState === "stale" ? "Stale cache" : "Ready");
  }

  function loadTrack() {
    var trackJsonUrl = getTrackJsonUrl();
    renderSetupState("Loading TrackDraw minimap...\n" + trackJsonUrl, "Loading");

    fetch(trackJsonUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error(
            "TrackDraw JSON returned HTTP " +
              response.status +
              " for " +
              trackJsonUrl
          );
        }
        return response.text();
      })
      .then(function (body) {
        try {
          return JSON.parse(body);
        } catch (error) {
          throw new Error(
            "TrackDraw JSON response was not valid JSON from " + trackJsonUrl
          );
        }
      })
      .then(function (payload) {
        if (!payload.ok || !payload.track) {
          renderSetupState(getReadinessMessage(payload), payload.state);
          return;
        }
        renderTrack(payload.track, payload.state);
      })
      .catch(function (error) {
        renderSetupState(
          error && error.message
            ? error.message
            : "Could not load local TrackDraw cache.",
          "Error"
        );
      });
  }

  document.addEventListener("DOMContentLoaded", loadTrack);
})(window, document);
