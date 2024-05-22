var data_dependencies = [
    'all_languages',
    'language',
    'result_data',
];

rotorhazard.show_messages = false;
var result_data;

$(document).ready(function () {
    console.log('stream_class_id:', stream_class_id);
    if (stream_class_id == 0) {
        socket.emit('load_data', {'load_types': [
            'current_heat',
        ]});
    }

    socket.on('language', function (msg) {
        if (msg.language) {
            rotorhazard.interface_language = msg.language;
        }
    });

    // Will update after changing heat
    socket.on('current_heat', function (msg) {
        if (msg.heat_class) {
            stream_class_id = msg.heat_class;
            if (result_data != undefined) {
                showResultsData(result_data);
            }
        } else {
            showNoResults();
        }
    });

    socket.on('result_data', function (msg) {
        result_data = msg;
        showResultsData(result_data);
    });
});

function showNoResults() {
    $('#header h1').html(__('No Data'));
    $('#leaderboard').html('<p>' + __('There is no saved race data available to view.') + '</p>');
}

function showResultsData(data) {
    if (!$.isEmptyObject(data.heats)) {
        console.log(data);
        for (let class_id in data.heats_by_class) {
            if (class_id == stream_class_id) {
                let current_class = data.classes[class_id];
                let current_class_leaderboard = current_class.leaderboard[current_class.leaderboard.meta.primary_leaderboard];
                console.log(current_class);

                // If class is not empty
                if (current_class) {
                    // Define class name
                    if (current_class.name) {
                        class_name = current_class.name + ' - Overall Ranking'
                    } else {
                        class_name = __('Class') + ' ' + current_class.id + ' - Overall Ranking';
                    }
                    $('#header h1').html(class_name)

                    // If class has ranking
                    if (current_class.ranking) {
                        console.log('Ranking:', current_class.ranking);
                    } else if ([current_class_leaderboard].length) {
                        generateLeaderboard(current_class_leaderboard);
                    } else {
                        showNoResults();
                    }
                }
            }
        }
    } else {
        showNoResults();
    }
}

// Function to dynamically generate the leaderboard
function generateLeaderboard(data) {
    var leaderboard = document.getElementById("leaderboard");
    leaderboard.innerHTML = '';

    // Create 4 columns
    for (var i = 0; i < 4; i++) {
        var column = document.createElement("div");
        column.className = "column";
        leaderboard.appendChild(column);
    }

    // Add the data to the columns
    var columns = document.querySelectorAll(".column");
    for (var i = 0; i < Math.min(data.length, 32); i++) {
        var columnIndex = Math.floor(i / 8);
        var column = columns[columnIndex];

        // Create an entry element
        var entry = document.createElement("div");
        entry.className = "entry";
        entry.style.animationDelay = (i % 8) * 0.1 + "s";

        // Create a box for the position
        var positionBox = document.createElement("div");
        positionBox.className = "box position";

        // Add the position to the box
        var position = document.createElement("p");
        position.textContent = data[i].position;
        positionBox.appendChild(position);

        // Set the color of the box based on the position
        switch (data[i].position) {
            case 1:
                positionBox.style.backgroundColor = 'gold';
                break;
            case 2:
                positionBox.style.backgroundColor = 'silver';
                break;
            case 3:
                positionBox.style.backgroundColor = '#cd7f32';
                break;
            default:
                positionBox.style.backgroundColor = 'darkorange';
        }

        // Add the box to the entry
        entry.appendChild(positionBox);

        // Add the pilot name to the entry
        var pilotName = document.createElement("p");
        pilotName.id = "pilot_name";
        pilotName.textContent = data[i].callsign;
        entry.appendChild(pilotName);
        column.appendChild(entry);

        // Animation to show the entries
        setTimeout(function (entry) {
            entry.classList.add("show");
        }, 100 * i, entry);
    }
}