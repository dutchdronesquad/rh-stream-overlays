var data_dependencies = [
  "all_languages",
  "language",
  "race_status",
  "leaderboard",
  "current_laps",
  "current_heat",
];

// Store previous total lap count to detect new laps
var previousTotalLapCount = 0;

// Override showCurrentLaps to only add new laps, not rebuild entire list
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
      previousTotalLapCount = 0;
    }
    return;
  }

  var allLaps = nodeIndex.laps;
  var totalLapCount = allLaps.length;

  // If list is empty or race was reset, rebuild everything
  if (this.$lapList.children().length === 0 || totalLapCount < previousTotalLapCount) {
    this.$lapList.empty();
    var displayLaps = allLaps.slice(
      Math.max(allLaps.length - this.options.lapDisplayLimit, 0)
    );
    for (var i = 0; i < displayLaps.length; i++) {
      var lap = displayLaps[i];
      this.$lapList.prepend(this.buildLapListItem(lap, nodeIndex, i, false));
    }
    previousTotalLapCount = totalLapCount;
    return;
  }

  // Only add new laps if we have more than before
  if (totalLapCount > previousTotalLapCount) {
    var newLapsCount = totalLapCount - previousTotalLapCount;

    // Add new laps at the top (prepend)
    for (var j = 0; j < newLapsCount; j++) {
      var lapIndex = totalLapCount - 1 - j;
      var newLap = allLaps[lapIndex];
      var $newLapItem = this.buildLapListItem(newLap, nodeIndex, 0, true);
      this.$lapList.prepend($newLapItem);
    }

    // Always keep only the last N items (remove excess from bottom)
    var children = this.$lapList.children();
    while (children.length > this.options.lapDisplayLimit) {
      children.last().remove();
      children = this.$lapList.children();
    }

    previousTotalLapCount = totalLapCount;
  }

  // Update fastest lap highlighting for all visible laps
  var displayLaps = allLaps.slice(
    Math.max(allLaps.length - this.options.lapDisplayLimit, 0)
  );
  this.updateFastestLapHighlight(displayLaps, nodeIndex);
};

// Update fastest lap highlighting dynamically
NodeOverlay.prototype.updateFastestLapHighlight = function (displayLaps, nodeIndex) {
  var self = this;

  // Remove fastest-lap class from all items first
  this.$lapList.find('li').removeClass('fastest-lap');

  // Find and highlight the fastest lap
  if (typeof nodeIndex.fastest_lap_index !== 'undefined') {
    displayLaps.forEach(function(lap) {
      if (typeof lap.lap_index !== 'undefined' && lap.lap_index === nodeIndex.fastest_lap_index) {
        // Find the corresponding DOM element
        // Items are prepended, so we need to find by lap_index
        self.$lapList.find('li').each(function() {
          var $lapNumBox = $(this).find('.lap-num-box');
          var lapLabel = lap.lap_number === 0 ? "HS" : lap.lap_number.toString();
          if ($lapNumBox.text() === lapLabel) {
            $(this).addClass('fastest-lap');
          }
        });
      }
    });
  }
};

// Override the buildLapListItem method for Apex theme
NodeOverlay.prototype.buildLapListItem = function (lap, nodeIndex, index, shouldAnimate) {
  var lapTime = this.formatLapTime(lap);
  var lapLabel = lap.lap_number === 0 ? "HS" : lap.lap_number;

  // Create lap number box
  var lapNumBox = $("<div>")
    .addClass("lap-num-box")
    .text(lapLabel);

  // Create lap time box
  var lapTimeBox = $("<div>")
    .addClass("lap-time-box")
    .text(lapTime);

  // Create list item with both boxes
  var lapItem = $("<li>")
    .append(lapNumBox)
    .append(lapTimeBox);

  // Animate new laps
  if (shouldAnimate) {
    lapItem.addClass("new-lap");
    // Remove animation class after it completes
    setTimeout(function() {
      lapItem.removeClass("new-lap");
    }, 400);
  }

  if (lap.lap_number === 0) {
    lapItem.addClass("from_start");
  }

  if (
    typeof lap.lap_index !== "undefined" &&
    lap.lap_index === nodeIndex.fastest_lap_index
  ) {
    lapItem.addClass("fastest-lap");
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

new NodeOverlay({
  streamnode: streamnode,
  lapDisplayLimit: 3,
  popupAnimation: function ($popup) {
    if (!$popup || !$popup.length) {
      return;
    }

    // Add 'show' class to trigger CSS zoom animation
    $popup.addClass('show');

    // Remove 'show' class after animation completes (2.9s total: 0.4s in + 2.2s delay + 0.3s out)
    setTimeout(function () {
      $popup.removeClass('show');
    }, 2900);
  }
});
