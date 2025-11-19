/* Shared logic for RotorHazard node overlays */
(function (window, $) {
  "use strict";

  function initSocketWarningWatcher() {
    if (window.__overlaySocketWarningWatcher) {
      return;
    }
    window.__overlaySocketWarningWatcher = true;

    function toggleWarning(isConnected) {
      var $warning = $(".socket-warning");
      if (!$warning.length) {
        return;
      }
      if (isConnected) {
        $warning.stop(true, true).slideUp();
      } else {
        $warning.stop(true, true).slideDown();
      }
    }

    if (typeof socket !== "undefined") {
      socket.on("connect", function () {
        toggleWarning(true);
      });
      socket.on("disconnect", function () {
        toggleWarning(false);
      });
      toggleWarning(socket.connected);
    }
  }

  var DEFAULT_SELECTORS = {
    position: "#pilot_position",
    ordinal: "#pos_ordinal",
    callsign: "#pilot_callsign",
    totalTime: "#total_time",
    lapList: "#pilot_lap-times",
    lastLap: "#last_laptime",
    lapNumber: ".lap_number",
    popup: "#popup-container",
  };

  function NodeOverlay(options) {
    this.options = $.extend(
      {
        streamnode: 0,
        selectors: DEFAULT_SELECTORS,
        lapDisplayLimit: 10,
        popupAnimation: null,
      },
      options || {}
    );

    this.streamnode = parseInt(this.options.streamnode, 10);
    if (isNaN(this.streamnode)) {
      this.streamnode = 0;
    }

    this.previousLapCount = 0;
    this.currentLaps = null;

    this.init();
  }

  NodeOverlay.prototype.init = function () {
    var self = this;
    $(document).ready(function () {
      initSocketWarningWatcher();
      rotorhazard.show_messages = false;
      self.cacheDom();
      self.registerSocketHandlers();
    });
  };

  NodeOverlay.prototype.cacheDom = function () {
    var selectors = this.options.selectors;
    this.$position = $(selectors.position);
    this.$ordinal = $(selectors.ordinal);
    this.$callsign = $(selectors.callsign);
    this.$totalTime = $(selectors.totalTime);
    this.$lapList = $(selectors.lapList);
    this.$lastLap = $(selectors.lastLap);
    this.$lapNumber = $(selectors.lapNumber);
    this.$popup = $(selectors.popup);
  };

  NodeOverlay.prototype.registerSocketHandlers = function () {
    var self = this;

    socket.on("language", function (msg) {
      if (msg.language) {
        rotorhazard.interface_language = msg.language;
      }
    });

    socket.on("current_heat", function (msg) {
      self.applyHeatColors(msg);
    });

    socket.on("current_laps", function (msg) {
      self.currentLaps = msg.current;
      self.showCurrentLaps();
    });

    socket.on("race_status", function (msg) {
      rotorhazard.event.race_status = msg;
      self.showCurrentLaps();
    });

    socket.on("leaderboard", function (msg) {
      self.handleLeaderboard(msg);
    });
  };

  NodeOverlay.prototype.applyHeatColors = function (msg) {
    if (!msg.heatNodes || typeof this.streamnode === "undefined") {
      return;
    }

    var node = msg.heatNodes[this.streamnode];
    if (node && node.activeColor) {
      var color = colorvalToHex(node.activeColor);
      var contrastColorValue = contrastColor(color);
      $("html").css("--pilot_color", color);
      $("html").css("--contrast_pilot_color", contrastColorValue);
      $("html").css("--position_foreground_color", color);
      $("html").css("--position_background_color", contrastColorValue);
      $("html").css("--fast_lap_color", color);
      $("html").css("--contrast_fast_lap_color", contrastColorValue);
    } else {
      $("html").css(
        "--pilot_color",
        "hsl(var(--hue_0), var(--sat_0), var(--lum_0_low))"
      );
      $("html").css("--contrast_pilot_color", "var(--contrast_0_low)");
      $("html").css(
        "--position_background_color",
        "hsl(var(--hue_1), var(--sat_1), var(--lum_1_high))"
      );
      $("html").css("--position_foreground_color", "var(--contrast_1_high)");
      $("html").css(
        "--fast_lap_color",
        "hsl(var(--hue_1), var(--sat_1), var(--lum_1_high))"
      );
      $("html").css("--contrast_fast_lap_color", "var(--contrast_1_high)");
    }
  };

  NodeOverlay.prototype.handleLeaderboard = function (msg) {
    if (!msg || !msg.current || !msg.current.leaderboard) {
      this.clearPilotInfo();
      return;
    }

    var race = msg.current.leaderboard;
    var primaryLeaderboard = race.meta && race.meta.primary_leaderboard;
    var leaderboard = primaryLeaderboard ? race[primaryLeaderboard] : null;

    if (!leaderboard) {
      this.clearPilotInfo();
      return;
    }

    var pilotData = null;
    var leaderboardEntries = Array.isArray(leaderboard)
      ? leaderboard
      : this.objectValues(leaderboard);

    for (var i = 0; i < leaderboardEntries.length; i++) {
      if (leaderboardEntries[i].node == this.streamnode) {
        pilotData = leaderboardEntries[i];
        break;
      }
    }

    if (!pilotData) {
      this.clearPilotInfo();
      return;
    }

    this.updatePilotInfo(pilotData, primaryLeaderboard);
  };

  NodeOverlay.prototype.updatePilotInfo = function (
    pilotData,
    primaryLeaderboard
  ) {
    var newLapCount = pilotData.laps || 0;
    if (
      this.$popup.length &&
      newLapCount > 0 &&
      typeof this.previousLapCount === "number" &&
      newLapCount > this.previousLapCount
    ) {
      this.animatePopup();
    }
    this.previousLapCount = newLapCount;

    if (this.$position.length) {
      this.$position.text(
        pilotData.position != null ? pilotData.position : "-"
      );
    }

    if (this.$ordinal.length) {
      this.$ordinal.text(
        pilotData.position ? NodeOverlay.getOrdinal(pilotData.position) : ""
      );
    }

    if (this.$callsign.length) {
      this.$callsign.text(pilotData.callsign || "");
    }

    if (this.$lastLap.length) {
      this.$lastLap.text(pilotData.last_lap || "00:00.000");
    }

    if (this.$lapNumber.length) {
      this.$lapNumber.text(pilotData.laps != null ? pilotData.laps : 0);
    }

    if (this.$totalTime.length) {
      this.$totalTime.text(this.formatRankStat(pilotData, primaryLeaderboard));
    }
  };

  NodeOverlay.prototype.formatRankStat = function (
    pilotData,
    primaryLeaderboard
  ) {
    if (primaryLeaderboard === "by_fastest_lap") {
      return pilotData.fastest_lap || "";
    }
    if (primaryLeaderboard === "by_consecutives") {
      return pilotData.consecutives || "";
    }
    return pilotData.total_time || "";
  };

  NodeOverlay.prototype.showCurrentLaps = function () {
    if (
      !this.currentLaps ||
      !rotorhazard.event ||
      !rotorhazard.event.race_status
    ) {
      return;
    }

    var nodeIndex =
      this.currentLaps.node_index &&
      this.currentLaps.node_index[this.streamnode];
    if (!nodeIndex || !nodeIndex.laps || !this.$lapList.length) {
      if (this.$lapList.length) {
        this.$lapList.empty();
      }
      return;
    }

    var laps = nodeIndex.laps.slice(
      Math.max(nodeIndex.laps.length - this.options.lapDisplayLimit, 0)
    );
    this.$lapList.empty();

    for (var i = 0; i < laps.length; i++) {
      var lap = laps[i];
      this.$lapList.prepend(this.buildLapListItem(lap, nodeIndex, i));
    }
  };

  NodeOverlay.prototype.buildLapListItem = function (lap, nodeIndex, index) {
    var lapTime = this.formatLapTime(lap);
    var lapLabel = lap.lap_number === 0 ? "HS" : lap.lap_number;
    var lapItem = $("<li>").text(lapLabel + "| " + lapTime);

    if (lap.lap_number === 0) {
      lapItem.text("HS: " + lapTime);
      lapItem.addClass("from_start");
    }

    if (
      typeof lap.lap_index !== "undefined" &&
      lap.lap_index === nodeIndex.fastest_lap_index
    ) {
      lapItem.addClass("fastest_lap");
    }

    if (
      index > 0 &&
      typeof lap.lap_raw === "number" &&
      lap.lap_raw < rotorhazard.min_lap * 1000
    ) {
      lapItem.addClass("min-lap-warning");
    }

    return lapItem;
  };

  NodeOverlay.prototype.formatLapTime = function (lap) {
    var lapTime = lap.lap_time_formatted || lap.lap_time || "";
    if (lap.splits && lap.splits.length > 0) {
      var splitParts = [];
      for (var i = 0; i < lap.splits.length; i++) {
        var split = lap.splits[i];
        if (!split) {
          continue;
        }
        var splitTime = split.split_time_formatted || split.split_time || "";
        if (split.split_speed) {
          splitParts.push(splitTime + "/" + split.split_speed);
        } else {
          splitParts.push(splitTime);
        }
      }
      if (splitParts.length) {
        lapTime += " (" + splitParts.join(", ") + ")";
      }
    }
    return lapTime;
  };

  NodeOverlay.prototype.animatePopup = function () {
    if (typeof this.options.popupAnimation === "function") {
      this.options.popupAnimation(this.$popup);
    }
  };

  NodeOverlay.prototype.clearPilotInfo = function () {
    if (this.$position.length) {
      this.$position.text("");
    }
    if (this.$ordinal.length) {
      this.$ordinal.text("");
    }
    if (this.$callsign.length) {
      this.$callsign.text("");
    }
    if (this.$lastLap.length) {
      this.$lastLap.text("");
    }
    if (this.$lapNumber.length) {
      this.$lapNumber.text("0");
    }
    if (this.$totalTime.length) {
      this.$totalTime.text("");
    }
    if (this.$lapList.length) {
      this.$lapList.empty();
    }
  };

  NodeOverlay.getOrdinal = function (value) {
    var mod100 = value % 100;
    if (mod100 >= 11 && mod100 <= 13) {
      return "th";
    }
    switch (value % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };

  NodeOverlay.prototype.objectValues = function (obj) {
    if (!obj) {
      return [];
    }
    if (Object.values) {
      return Object.values(obj);
    }
    var values = [];
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        values.push(obj[key]);
      }
    }
    return values;
  };

  window.NodeOverlay = NodeOverlay;
})(window, jQuery);
