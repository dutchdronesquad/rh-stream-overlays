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
        console.log('data:', data);
        for (let class_id in data.heats_by_class) {
            if (class_id == stream_class_id) {
                let currentClass = data.classes[class_id];
                let currentClassLeaderboard = currentClass.leaderboard[currentClass.leaderboard.meta.primary_leaderboard];
                let displayType = currentClass.leaderboard.meta.primary_leaderboard;

                if (currentClass) {
                    // Define class name
                    if (currentClass.name) {
                        className = 'Leaderboard - ' + currentClass.name;
                    } else {
                        className = 'Leaderboard - Class ' + currentClass.id;;
                    }
                    $('#title').html(className)

                    // If class has ranking
                    if (currentClass.ranking) {
                        console.log('Ranking:', currentClass.ranking);
                    } else if ([currentClassLeaderboard].length) {
                        generateLeaderboard(currentClassLeaderboard, displayType, intervalTime=10);
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

let currentGroupIndex = 0;
const itemsPerPage = 8;
let intervalID;

function generateLeaderboard(data, displayType, intervalTime) {
    console.log('leaderboard:', data);
    const groupedData = chunkArray(data, itemsPerPage);
    updateHeaderLabels(displayType);
    displayGroup(data, groupedData, displayType, currentGroupIndex);

    if (data.length > itemsPerPage) {
        clearInterval(intervalID);
        intervalID = setInterval(() => {
            currentGroupIndex = (currentGroupIndex + 1) % groupedData.length;
            hideEntries().then(() => {
                displayGroup(data, groupedData, displayType, currentGroupIndex);
            });
        }, intervalTime * 1000);
        document.getElementById("currentIndexIndicator").style.display = "block";
    } else {
        document.getElementById("currentIndexIndicator").style.display = "none";
    }
}

function chunkArray(array, chunkSize) {
    const results = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        results.push(array.slice(i, i + chunkSize));
    }
    return results;
}

// Function to display the group of entries
function displayGroup(data, groupedData, displayType, groupIndex) {
    const leaderboard = document.getElementById("leaderboard");
    leaderboard.innerHTML = '';

    const group = groupedData[groupIndex];
    group.forEach((dataItem, index) => {
        const entry = createEntry(dataItem, displayType);
        leaderboard.appendChild(entry);

        // Add the show class to activate the animation
        setTimeout(() => {
            entry.classList.add("show");
        }, 100 * index);
    });

    // Update the current index indicator
    const currentIndexIndicator = document.getElementById("currentIndexIndicator");
    const isShortVersion = window.innerHeight <= 720;
    const startRange = groupIndex * itemsPerPage + 1;
    const endRange = Math.min((groupIndex + 1) * itemsPerPage, data.length);
    currentIndexIndicator.textContent = isShortVersion ? `${startRange}-${endRange}/${data.length}` : `Showing ${startRange}-${endRange} of ${data.length}`;
}

// Function to create an entry element
function createEntry(dataItem, displayType) {
    var entry = document.createElement("div");
    entry.className = "entry";

    var positionBox = document.createElement("div");
    positionBox.className = "box position";

    var position = document.createElement("p");
    position.textContent = dataItem.position;
    positionBox.appendChild(position);

    // Set the color of the box based on the position
    switch (dataItem.position) {
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

    entry.appendChild(positionBox);

    var info = document.createElement("div");
    info.className = "info";

    var leftInfo = createLeftInfo(dataItem.callsign);
    var rightInfo = createRightInfo(dataItem, displayType);

    info.appendChild(leftInfo);
    info.appendChild(rightInfo);
    entry.appendChild(info);
    return entry;
}

function createLeftInfo(callsign) {
    var leftInfo = document.createElement("div");
    leftInfo.className = "left";
    var pilotName = document.createElement("p");
    pilotName.className = "pilot_name";
    pilotName.textContent = callsign;

    leftInfo.appendChild(pilotName);
    return leftInfo;
}

function createRightInfo(dataItem, displayType) {
    var rightInfo = document.createElement("div");
    rightInfo.className = "right";

    if (displayType == 'by_race_time') {
        rightInfo.style.gridTemplateColumns = 'repeat(3, 1fr)';
        rightInfo.appendChild(createTextElement("p", "laps", dataItem.laps));
        rightInfo.appendChild(createTextElement("p", "avg", dataItem.average_lap));
        rightInfo.appendChild(createTextElement("p", "total_time", dataItem.total_time));
    } else if (displayType == 'by_fastest_lap') {
        rightInfo.style.gridTemplateColumns = 'repeat(2, 1fr)';
        rightInfo.appendChild(createTextElement("p", "fastest_lap", dataItem.fastest_lap));
        let sourceInfo = dataItem.fastest_lap_source;
        rightInfo.appendChild(createTextElement("p", "source", sourceInfo.displayname + ' / ' + __('Round') + ' ' + sourceInfo.round));
    } else if (displayType == 'by_consecutives') {
        rightInfo.style.gridTemplateColumns = 'repeat(2, 1fr)';
        rightInfo.appendChild(createTextElement("p", "consecutive", dataItem.consecutives_base + '/' + dataItem.consecutives));
        let sourceInfo = dataItem.consecutives_source;
        rightInfo.appendChild(createTextElement("p", "source", sourceInfo.displayname + ' / ' + __('Round') + ' ' + sourceInfo.round));
    }

    return rightInfo;
}

function createTextElement(tag, className, textContent) {
    var element = document.createElement(tag);
    element.className = className;
    element.textContent = textContent;
    return element;
}

// Function to dynamically define the header labels based on the display type
function updateHeaderLabels(displayType) {
    var headerRight = document.querySelector("#header .right");
    headerRight.innerHTML = '';

    let labels = [];
    if (displayType == 'by_race_time') {
        headerRight.style.gridTemplateColumns = 'repeat(3, 1fr)';
        labels = ['LAPS', 'AVG', 'TOTAL'];
    } else if (displayType == 'by_fastest_lap') {
        headerRight.style.gridTemplateColumns = 'repeat(2, 1fr)';
        labels = ['FASTEST LAP', 'SOURCE'];
    } else if (displayType == 'by_consecutives') {
        headerRight.style.gridTemplateColumns = 'repeat(2, 1fr)';
        labels = ['CONSECUTIVE', 'SOURCE'];
    }

    labels.forEach(labelText => {
        let label = document.createElement("p");
        label.className = "label";
        label.textContent = labelText;
        headerRight.appendChild(label);
    });
}

// Function to hide the entries before displaying the next group
function hideEntries() {
    return new Promise((resolve) => {
        const entries = document.querySelectorAll('.entry');
        entries.forEach((entry, index) => {
            setTimeout(() => {
                entry.classList.add('hide');
            }, 100 * index);
        });
        setTimeout(resolve, 100 * entries.length + 500);
    });
}