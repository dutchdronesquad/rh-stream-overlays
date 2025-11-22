var data_dependencies = [
  "all_languages",
  "language",
  "current_heat",
  "heat_data",
  "pilot_data",
  "class_data",
  "format_data",
  "frequency_data",
];

var heatOverlayState = {
  numNodes: (window.heatOverlayConfig && heatOverlayConfig.num_nodes) || 0,
  heats: [],
  heatById: {},
  pilots: [],
  pilotById: {},
  classes: [],
  classById: {},
  formats: [],
  formatById: {},
  currentHeatId: null,
  heatClassId: null,
  nextRound: null,
  heatFormatId: null,
  heatNodes: null,
  labels: (window.heatOverlayConfig && heatOverlayConfig.labels) || {},
  lastRenderedHeatId: null,
  lastRenderedSlots: null,
};

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

$(document).ready(function () {
  initSocketWarningWatcher();
  rotorhazard.show_messages = false;
  initializeNodeModels();
  if ($("#heat_lead").length) {
    $("#heat_lead").text(getLabel("upNext", "Up Next"));
  }

  socket.on("language", function (msg) {
    if (msg.language) {
      rotorhazard.interface_language = msg.language;
    }
  });

  socket.on("frequency_data", function (msg) {
    applyFrequencyData(msg);
  });

  socket.on("heat_data", function (msg) {
    heatOverlayState.heats = toArray(msg.heats);
    heatOverlayState.heatById = indexById(heatOverlayState.heats, "id");
    renderHeat();
  });

  socket.on("pilot_data", function (msg) {
    heatOverlayState.pilots = toArray(msg.pilots);
    heatOverlayState.pilotById = indexById(heatOverlayState.pilots, "pilot_id");
    renderHeat();
  });

  socket.on("class_data", function (msg) {
    heatOverlayState.classes = toArray(msg.classes);
    heatOverlayState.classById = indexById(heatOverlayState.classes, "id");
    renderHeat();
  });

  socket.on("format_data", function (msg) {
    heatOverlayState.formats = toArray(msg.formats);
    heatOverlayState.formatById = indexById(heatOverlayState.formats, "id");
    renderHeat();
  });

  socket.on("current_heat", function (msg) {
    heatOverlayState.currentHeatId = msg.current_heat;
    heatOverlayState.heatClassId = msg.heat_class;
    heatOverlayState.nextRound = msg.next_round;
    heatOverlayState.heatFormatId = msg.heat_format;
    heatOverlayState.heatNodes = msg.heatNodes || null;
    renderHeat();
  });
});

function initializeNodeModels() {
  for (var i = 0; i < heatOverlayState.numNodes; i++) {
    rotorhazard.nodes[i] = new nodeModel();
  }
}

function applyFrequencyData(msg) {
  if (!msg || !msg.fdata) {
    return;
  }
  for (var idx in msg.fdata) {
    var fObj = freq.getFObjbyFData(msg.fdata[idx]);
    if (rotorhazard.nodes[idx]) {
      rotorhazard.nodes[idx].fObj = fObj;
    }
  }
  if (typeof freq !== "undefined" && typeof freq.updateBlocks === "function") {
    freq.updateBlocks();
  }
}

function toArray(collection) {
  if (!collection) {
    return [];
  }
  return Array.isArray(collection) ? collection : Object.values(collection);
}

function indexById(collection, idField) {
  var map = {};
  if (!collection) {
    return map;
  }
  for (var i = 0; i < collection.length; i++) {
    var entry = collection[i];
    if (entry && typeof entry[idField] !== "undefined") {
      map[entry[idField]] = entry;
    }
  }
  return map;
}

function renderHeat() {
  var $slots = $("#heat_slots");
  if (!$slots.length) {
    return;
  }

  var isPractice = !heatOverlayState.currentHeatId;
  var heat =
    heatOverlayState.currentHeatId &&
    heatOverlayState.heatById[heatOverlayState.currentHeatId];

  // Check if we need to re-render
  var currentSlotsKey = generateSlotsKey(heat, isPractice);
  if (heatOverlayState.lastRenderedHeatId === heatOverlayState.currentHeatId &&
      heatOverlayState.lastRenderedSlots === currentSlotsKey) {
    // Only update header if heat is the same
    updateHeader(heat, isPractice);
    return;
  }

  // Update tracking state
  heatOverlayState.lastRenderedHeatId = heatOverlayState.currentHeatId;
  heatOverlayState.lastRenderedSlots = currentSlotsKey;

  var defaultNotice = updateHeader(heat, isPractice);

  var slots = isPractice
    ? buildPracticeSlots()
    : heat
    ? buildHeatSlots(heat)
    : buildNodeSnapshotSlots(false);

  if (!slots.length && !isPractice && !heat) {
    return;
  }

  slots = slots.filter(function (slot) {
    return slot && !slot.placeholder;
  });

  $slots.empty();

  if (!slots.length) {
    var emptyLabel = isPractice
      ? getLabel("practiceNotice", "")
      : getLabel("noSeats", "Waiting for pilots");
    $("#heat_notice").text(emptyLabel);
    $("<div>")
      .addClass("heat-empty")
      .text(emptyLabel || getLabel("noSeats", "Waiting for pilots"))
      .appendTo($slots);
    return;
  }
  $("#heat_notice").text(defaultNotice || "");

  for (var i = 0; i < slots.length; i++) {
    var slot = slots[i];
    var $card = $("<article>").addClass("slot-card");

    $("<span>")
      .addClass("seat-chip")
      .text(slot.seatLabel || "")
      .appendTo($card);

    var $body = $("<div>").addClass("card-body");
    $("<p>").addClass("callsign").text(slot.callsign || "").appendTo($body);
    if (slot.pilot) {
      $("<p>").addClass("pilot-name").text(slot.pilot).appendTo($body);
    }
    if (slot.note) {
      $("<p>").addClass("slot-note").text(slot.note).appendTo($body);
    }
    $card.append($body);

    var $channel = $("<div>")
      .addClass("channel-block")
      .attr("data-node", slot.node_index);
    $("<span>").addClass("ch").appendTo($channel);
    $("<span>").addClass("fr").appendTo($channel);
    $card.append($channel);

    $card.appendTo($slots);
  }

  if (typeof freq !== "undefined" && typeof freq.updateBlocks === "function") {
    freq.updateBlocks();
  }
}

function updateHeader(heat, isPractice) {
  var labels = heatOverlayState.labels;
  var notice = "";
  if (isPractice) {
    $("#heat_name").text(getLabel("practiceMode", "Practice Mode"));
    $("#class_name").text("");
    $("#round_info").text("");
    $("#format_name").text("");
    notice = getLabel("practiceNotice", "");
    $("#heat_notice").text(notice);
    return notice;
  }

  if (!heat) {
    $("#heat_name").text(getLabel("noHeat", "Waiting for heat..."));
    $("#class_name").text("");
    $("#round_info").text("");
    $("#format_name").text("");
    $("#heat_notice").text("");
    return "";
  }

  $("#heat_name").text(heat.displayname || getLabel("noHeat", ""));

  var className = getLabel("classFallback", "");
  if (heat.class_id && heatOverlayState.classById[heat.class_id]) {
    className = heatOverlayState.classById[heat.class_id].displayname;
  }
  $("#class_name").text(className || "");

  var roundLabel = "";
  if (heatOverlayState.nextRound) {
    roundLabel =
      (getLabel("roundLabel", "Round") || "Round") +
      " " +
      heatOverlayState.nextRound;
  }
  $("#round_info").text(roundLabel);

  var formatLabel = "";
  var formatId =
    heatOverlayState.heatFormatId || heat.format_id || heat.format_id_rel;
  if (formatId && heatOverlayState.formatById[formatId]) {
    formatLabel = heatOverlayState.formatById[formatId].name;
  } else {
    formatLabel = getLabel("formatFallback", "");
  }
  $("#format_name").text(formatLabel || "");

  // No auto-assign or lock notice in the UI for a cleaner presentation
  notice = "";
  $("#heat_notice").text(notice);
  return notice;
}

function buildHeatSlots(heat) {
  if (!heat || !heat.slots) {
    return [];
  }

  var slots = toArray(heat.slots).sort(compareSlots);
  var isLocked =
    heat.locked ||
    heat.status === 2 ||
    heat.auto_frequency === false ||
    false;
  var result = [];

  for (var i = 0; i < slots.length; i++) {
    var slot = slots[i];
    if (typeof slot.node_index !== "number") {
      continue;
    }

    var pilot =
      slot.pilot_id && heatOverlayState.pilotById[slot.pilot_id]
        ? heatOverlayState.pilotById[slot.pilot_id]
        : null;

    var card = {
      node_index: slot.node_index,
      seatLabel: formatSeatLabel(slot.node_index),
      callsign: "",
      pilot: "",
      note: "",
      placeholder: false,
    };

    if ((isLocked || slot.method === 0) && slot.pilot_id && pilot) {
      card.callsign = pilot.callsign || getLabel("pilotTBD", "TBD");
      card.pilot = pilot.name || "";
    } else if (slot.pilot_id && !pilot) {
      card.callsign = getLabel("pilotTBD", "TBD");
      card.pilot = "";
      card.placeholder = true;
    } else {
      var descriptor = describeSlotMethod(slot);
      card.callsign = descriptor || getLabel("emptySlot", "Awaiting Assignment");
      card.note = descriptor && slot.method > 0 ? descriptor : "";
      card.placeholder = true;
    }

    if (!card.pilot && pilot && pilot.name) {
      card.pilot = pilot.name;
    }

    if (!card.callsign) {
      card.callsign = getLabel("emptySlot", "Awaiting Assignment");
      card.placeholder = true;
    }

    result.push(card);
  }

  return result;
}

function describeSlotMethod(slot) {
  if (!slot) {
    return null;
  }
  if (slot.method === 1 && slot.seed_id) {
    var sourceHeat = heatOverlayState.heatById[slot.seed_id];
    if (sourceHeat) {
      return (
        sourceHeat.displayname +
        " " +
        getLabel("rankLabel", "Rank") +
        " " +
        (slot.seed_rank || "")
      );
    }
  } else if (slot.method === 2 && slot.seed_id) {
    var raceClass = heatOverlayState.classById[slot.seed_id];
    if (raceClass) {
      return (
        raceClass.displayname +
        " " +
        getLabel("rankLabel", "Rank") +
        " " +
        (slot.seed_rank || "")
      );
    }
  } else if (slot.method === 0 && slot.pilot_id) {
    var pilot = heatOverlayState.pilotById[slot.pilot_id];
    if (pilot) {
      return pilot.callsign;
    }
  }
  return null;
}

function buildPracticeSlots() {
  return buildNodeSnapshotSlots(true);
}

function buildNodeSnapshotSlots(isPractice) {
  var slots = [];
  var heatNodes = heatOverlayState.heatNodes || {};

  for (var idx in heatNodes) {
    if (!heatNodes.hasOwnProperty(idx)) {
      continue;
    }
    var info = heatNodes[idx];
    var seatIndex = parseInt(idx, 10);
    var pilotObj =
      info &&
      info.pilot_id &&
      heatOverlayState.pilotById[info.pilot_id]
        ? heatOverlayState.pilotById[info.pilot_id]
        : null;
    var callsign =
      (info && info.callsign) ||
      (pilotObj && pilotObj.callsign) ||
      getLabel("pilotTBD", "TBD");

    var displayPilot =
      pilotObj && pilotObj.name
        ? pilotObj.name
        : isPractice
        ? getLabel("practiceMode", "Practice Mode")
        : "";

    slots.push({
      node_index: seatIndex,
      seatLabel: formatSeatLabel(seatIndex),
      callsign: callsign,
      pilot: displayPilot,
      note: "",
      placeholder: !info || !info.callsign,
    });
  }

  return slots.sort(compareSlots);
}

function compareSlots(a, b) {
  return (a.node_index || 0) - (b.node_index || 0);
}

function formatSeatLabel(index) {
  return (getLabel("seatLabel", "Seat") || "Seat") + " " + (index + 1);
}

function getLabel(key, fallback) {
  return (heatOverlayState.labels && heatOverlayState.labels[key]) || fallback;
}

function generateSlotsKey(heat, isPractice) {
  if (isPractice) {
    var nodes = heatOverlayState.heatNodes || {};
    return "practice_" + JSON.stringify(nodes);
  }
  if (!heat || !heat.slots) {
    return "empty";
  }
  // Create a key based on heat slots and their pilots with detailed info
  var slots = toArray(heat.slots);
  var key = slots.map(function(slot) {
    var pilot = slot.pilot_id && heatOverlayState.pilotById[slot.pilot_id];
    var pilotInfo = pilot ? (pilot.callsign + "_" + pilot.name) : "empty";
    return slot.node_index + "_" + slot.pilot_id + "_" + slot.method + "_" + pilotInfo + "_" + slot.seed_id + "_" + slot.seed_rank;
  }).join("|");
  // Also include heat properties that affect display
  return heat.id + "_" + heat.displayname + "_" + heat.locked + "_" + heat.status + "_" + key;
}
