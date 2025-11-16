var data_dependencies = [
  "all_languages",
  "language",
  "race_status",
  "leaderboard",
  "current_laps",
  "current_heat",
];

new NodeOverlay({
  streamnode: streamnode,
  popupAnimation: function ($popup) {
    if (!$popup || !$popup.length) {
      return;
    }
    $popup.stop(true).animate({ right: "400px" }, 500);
    setTimeout(function () {
      $popup.animate({ right: "0px" }, 500);
    }, 3000);
  },
});
