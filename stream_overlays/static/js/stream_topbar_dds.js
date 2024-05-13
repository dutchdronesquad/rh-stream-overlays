var data_dependencies = [
  "leaderboard",
  "race_status",
  "result_data",
];

rotorhazard.show_messages = false;

var request_time;
var request_pi_time;
var resume_check = true;
var result_data;

function race_kickoff(msg) {
  rotorhazard.timer.stopAll();

  var staging_start_pi = msg.pi_staging_at_s * 1000; // convert seconds (pi) to millis (JS)
  var race_start_pi = msg.pi_starts_at_s * 1000; // convert seconds (pi) to millis (JS)

  rotorhazard.timer.race.hidden_staging = Boolean(msg.hide_stage_timer);
  rotorhazard.timer.race.count_up = Boolean(msg.race_mode);
  rotorhazard.timer.race.duration_tenths = msg.race_time_sec * 10;

  rotorhazard.timer.race.start(race_start_pi, staging_start_pi);
}

$(document).ready(function () {
  // get pi time
  rotorhazard.pi_time_request = window.performance.now();
  socket.emit("get_pi_time");

  socket.on("pi_time", function (msg) {
    var response_time = window.performance.now();
    var server_delay = response_time - rotorhazard.pi_time_request;
    var server_oneway = server_delay ? server_delay / 2 : server_delay;

    var server_time_differential = {
      'differential': (msg.pi_time_s * 1000) - response_time - server_oneway, // convert seconds (pi) to millis (JS)
      'response': parseFloat(server_delay)
    }

    // store sync sample
    rotorhazard.server_time_differential_samples.push(server_time_differential);

    // sort stored samples
    rotorhazard.server_time_differential_samples.sort(function (a, b) {
      return a.response - b.response;
    });

    // remove unusable samples
    var diff_min = rotorhazard.server_time_differential_samples[0].differential - rotorhazard.server_time_differential_samples[0].response
    var diff_max = rotorhazard.server_time_differential_samples[0].differential + rotorhazard.server_time_differential_samples[0].response

    rotorhazard.server_time_differential_samples = rotorhazard.server_time_differential_samples.filter(function (value, index, array) {
      return value.differential >= diff_min && value.differential <= diff_max;
    });

    // get filtered value
    var a = [];
    for (var i in rotorhazard.server_time_differential_samples) {
      a.push(rotorhazard.server_time_differential_samples[i].differential);
    }
    rotorhazard.server_time_differential = median(a);

    // pass current sync to timers
    rotorhazard.timer.race.sync();
    rotorhazard.timer.deferred.sync();

    // continue sampling for sync to improve accuracy
    if (rotorhazard.server_time_differential_samples.length < 10) {
      setTimeout(function () {
        rotorhazard.pi_time_request = window.performance.now();
        socket.emit("get_pi_time");
      }, Math.random() * 500 + 250); // 0.25 to 0.75s delay
    }

    // update server info
    var a = Infinity;
    for (var i in rotorhazard.server_time_differential_samples) {
      a = Math.min(a, rotorhazard.server_time_differential_samples[i].response);
    }
    rotorhazard.sync_within = Math.ceil(a);
  });

  socket.on("race_scheduled", function (msg) {
    if (msg.scheduled) {
      var deferred_start = msg.scheduled_at * 1000; // convert seconds (pi) to millis (JS)
      rotorhazard.timer.deferred.start(deferred_start, null);
    } else {
      rotorhazard.timer.deferred.stop();
    }
  });

  socket.on("race_status", function (msg) {
    switch (msg.race_status) {
      case 1: // Race running
        rotorhazard.race_status_go_time = window.performance.now();
        $("body").addClass("race-running");
        $("body").removeClass("race-stopped");
        $("body").removeClass("race-new");
        $(".timing-clock").removeClass("staging");
        if (resume_check) {
          race_kickoff(msg);
        }
        break;
      case 2: // Race stopped, clear or save laps
        $("body").removeClass("race-running");
        $("body").addClass("race-stopped");
        $("body").removeClass("race-new");
        $(".timing-clock").removeClass("staging");
        break;
      case 3: // staging
        $("body").removeClass("race-stopped");
        $("body").addClass("race-running");
        $("body").removeClass("race-new");
        $(".timing-clock").addClass("staging");
        if (resume_check) {
          race_kickoff(msg);
        }
        break;
      default: // Waiting to start new race
        $("body").removeClass("race-running");
        $("body").removeClass("race-stopped");
        $("body").addClass("race-new");
        $(".timing-clock").removeClass("staging");
        if (resume_check) {
          socket.emit("get_race_scheduled");
        }
        break;
    }

    resume_check = false;
  });

  socket.on("leaderboard", function (msg) {
    var race = msg.current;
    var heatName;

    // Change the heat name
    if (race.heat == 0) {
      heatName = __("Practice");
    } else {
      heatName = __("Heat") + " " + race.heat;
    }
    $(".curr_heat_Title").text(heatName);
  });

  socket.on("prestage_ready", function (msg) {
    request_time = new Date();
  });

  socket.on("stage_ready", function (msg) {
    race_kickoff(msg);
  });

  socket.on("stop_timer", function (msg) {
    rotorhazard.timer.stopAll();
  });
});