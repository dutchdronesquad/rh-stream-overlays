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
    $popup.stop(true).animate({ top: "45%" }, 500);
    setTimeout(function () {
      $popup.animate({ top: "-50%" }, 500);
    }, 3000);
  },
});
