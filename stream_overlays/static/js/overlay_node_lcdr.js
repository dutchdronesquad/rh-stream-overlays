var data_dependencies = [
  "all_languages",
  "language",
  "race_status",
  "leaderboard",
  "current_laps",
  "current_heat",
];

rotorhazard.show_messages = false;
current_laps = false;

// Variable to keep track of the previous lap count
var previousLapCount = 0;

$(document).ready(function () {
  rotorhazard.show_messages = false;

  socket.on("language", function (msg) {
    if (msg.language) {
      rotorhazard.interface_language = msg.language;
    }
  });

  socket.on("current_heat", function (msg) {
    for (var idx in msg.heatNodes) {
      hn = msg.heatNodes[streamnode];
      if (hn.activeColor) {
        var color = colorvalToHex(hn.activeColor);
        var contrast_color = contrastColor(color);
        $("html").css("--pilot_color", color);
        $("html").css("--contrast_pilot_color", contrast_color);
        $("html").css("--position_foreground_color", color);
        $("html").css("--position_background_color", contrast_color);
        $("html").css("--fast_lap_color", color);
        $("html").css("--contrast_fast_lap_color", contrast_color);
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
    }
  });

  socket.on("current_laps", function (msg) {
    current_laps = msg.current;
    show_current_laps();
  });

  socket.on("race_status", function (msg) {
    rotorhazard.event.race_status = msg;
    show_current_laps();
  });

  socket.on("leaderboard", function (msg) {
    var race = msg.current.leaderboard;

    primary_leaderboard = race.meta.primary_leaderboard;
    leaderboard = race[primary_leaderboard];

    found_streamnode = false;

    for (var i in leaderboard) {
      if (leaderboard[i].node == streamnode) {
        found_streamnode = true;

        pilot_data = leaderboard[i];

        // Show popup if the lap count has increased
        if (leaderboard[i].laps != previousLapCount && leaderboard[i].laps != 0) {
          $('#popup-container').animate({ right: '400px' }, 500);
          setTimeout(function() {
            $('#popup-container').animate({ right: '0px' }, 500); // 500ms animatietijd
          }, 3000);

          // Update the previous lap count for the correct streamnode
          previousLapCount = leaderboard[i].laps;
        }

        $("#pilot_position").text(pilot_data.position != null ? pilot_data.position : "-");
        $("#pos_ordinal").text(pilot_data.position ? getOrdinal(pilot_data.position) : "");
        $("#pilot_callsign").text(pilot_data.callsign);

        $("#last_laptime").text(pilot_data.last_lap ? pilot_data.last_lap : '00:00.000');
        $(".lap_number").text(pilot_data.laps);

        if (primary_leaderboard == "by_fastest_lap") {
          rank_stat = pilot_data.fastest_lap;
        } else if (primary_leaderboard == "by_consecutives") {
          rank_stat = pilot_data.consecutives;
        } else {
          rank_stat = pilot_data.total_time;
        }

        $("#total_time").text(rank_stat);
        break;
      }
    }

    if (!found_streamnode) {
      $("#pilot_position").text("");
      $("#pilot_callsign").html("");
      $("#total_time").text("");
    }
  });
});

// Function to get ordinal suffix for a number
function getOrdinal(n) {
  let ord = "th";
  if (n % 10 == 1 && n % 100 != 11) {
    ord = "st";
  } else if (n % 10 == 2 && n % 100 != 12) {
    ord = "nd";
  } else if (n % 10 == 3 && n % 100 != 13) {
    ord = "rd";
  }
  return ord;
}

// Function to show the current laps
function show_current_laps() {
  if (current_laps && rotorhazard.event.race_status) {
    var i = streamnode;
    var node_index = current_laps.node_index[streamnode];

    $('#pilot_lap-times').empty();

    display_laps = node_index.laps;
    while (display_laps.length > 10) {
      display_laps.shift();
    }

    $.each(display_laps, function (j, lap) {
      // j is loop num, lap is json object
      var tr = "";
      var lapTime = lap.lap_time;
      if (lap.splits.length > 0) {
        lapTime += " (";
        for (k = 0; k < lap.splits.length; k++) {
          var split = lap.splits[k];
          if (k > 0) {
            lapTime += ", ";
          }
          lapTime += split.split_time;
          if (split.split_speed) {
            lapTime += "/" + split.split_speed;
          }
        }
        lapTime += ")";
      }

      var lapLi = $('<li>').text(lap.lap_number + "| " + lapTime);

      // Time between start and race timer
      if (lap.lap_number == 0) {
        lapLi.text("HS: " + lap.lap_time);
        lapLi.addClass("from_start");
      }

      // When the lap is the fastest lap
      if (lap.lap_index == node_index.fastest_lap_index) {
        lapLi.addClass("fastest_lap");
      }

      // tr.append(
      //   $('<td class="display_lap_number">').text(lap.lap_number + ":")
      // );
      // $time_td = $("<td>").text(lap.lap_time + " ");
      // $local_prepend = $('<span class="from_start">');

      // $time_td.prepend($local_prepend);
      // tr.append($time_td);

      // When the lap should be invalid
      if (j && lap.lap_raw < rotorhazard.min_lap * 1000) {
        lapLi.addClass("min-lap-warning");
      }

      // if (
      //   !rotorhazard.event.race_status.unlimited_time &&
      //   lap.lap_time_stamp >
      //     rotorhazard.event.race_status.race_time_sec * 1000
      // ) {
      //   tr.addClass("after-time-expired");
      // }
      // tr.appendTo("#current-laps");

      // Add to horizontal laps list
      $('#pilot_lap-times').prepend(lapLi);
    });
  }
}
