// Saves options to chrome.storage
const exportData = () => {
    const JSONToFile = (filename) => {
        chrome.storage.local.get(function (obj) {
            const blob = new Blob([JSON.stringify(obj, null, 2)], {
                type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.json`;
            a.click();
            URL.revokeObjectURL(url);
        })
    };

    JSONToFile('MyThings');
};
const fileSelector = document.getElementById('file-selector');
fileSelector.addEventListener('change', (event) => {
    const fileList = event.target.files;
    console.log(fileList);
});

// Restores select box and checkbox state using the preferences
function clearData(e) {
    chrome.storage.local.clear(function () {
        const error = chrome.runtime.lastError;
        if (error) {
            console.error(error);
        }
        let map = new Map(Object.entries(JSON.parse(e.target.result)));
        map.forEach((value, key) => {
            chrome.storage.local.set({[key]: value}).then(() => {
                console.log(key + " is set");
            });
        })

    });
}

function validateFile(e) {
    chrome.storage.local.clear(function () {
        const error = chrome.runtime.lastError;
        if (error) {
            console.error(error);
        }
        let map = new Map(Object.entries(JSON.parse(e.target.result)));
        //validate json structure for each stations,items and dummies
        map.forEach((value, key) => {
            //check if the key is numeric
            if (!isNaN(key)) {
                //iterate over stations in value
                value.stations.forEach(station => {
                    //build key for station
                    let stationKey = key + "," + station+",s";
                    //check if key exists in the map
                    if (!map.has(stationKey)) {
                        console.log("Station key not found: " + stationKey);
                        alert("Station key not found: " + stationKey)
                    }
                })
                //iterate over items in value
                value.items.forEach(item => {
                    //build key for item
                    let itemKey = key + "," + item+",i";
                    //check if key exists in the map
                    if (!map.has(itemKey)) {
                        console.log("Item key not found: " + itemKey);
                        alert("Item key not found: " + itemKey)
                    }
                })
                //iterate over dummies in value
                value.dummies.forEach(dummy => {
                    //build key for dummy
                    let dummyKey = key + "," + dummy+",d";
                    //check if key exists in the map
                    if (!map.has(dummyKey)) {
                        console.log("Dummy key not found: " + dummyKey);
                        alert("Dummy key not found: " + dummyKey)
                    }
                })
            }
        })
        //validate gifs,backgrounds and trash
        //iterate over gifs in value
        const gifs = map.get("gifs");
        gifs.links.forEach((gifIndex) => {
            const gifId = "gifs,"+gifIndex;
            if (!map.has(gifId)) {
                console.log("No gif found: " + gifId);
                alert("No gif found: " + gifId)
            }
        })
        //iterate over backgrounds
        // iterate over backgrounds
        const backgrounds = map.get("backgrounds");
        backgrounds.links.forEach((backgroundIndex) => {
            const backgroundId = "backgrounds," + backgroundIndex;
            if (!map.has(backgroundId)) {
                console.log("No background found: " + backgroundId);
                alert("No background found: " + backgroundId);
            }
        });
        //iterate over trash
        // iterate over trash
        const trash = map.get("trash");
        trash.links.forEach((trashIndex) => {
            const trashId = "trash," + trashIndex;
            if (!map.has(trashId)) {
                console.log("No trash found: " + trashId);
                alert("No trash found: " + trashId);
            }
        });
    });
}

// stored in chrome.storage.
const importData = () => {
    const file = document.getElementById("file-selector").files[0];
    if (file) {
        const fr = new FileReader();
        fr.addEventListener("load", e => {
            clearData(e);
        });
        fr.readAsText(file);
    } else {
        alert("No file chosen. Please choose a file from your local drive.");
    }
};

const validateData = () => {
    const file = document.getElementById("file-selector").files[0];
    if (file) {
        const fr = new FileReader();
        fr.addEventListener("load", e => {
            validateFile(e);
        });
        fr.readAsText(file);
    } else {
        alert("No file chosen. Please choose a file from your local drive.");
    }
};
const resetData = () => {
    exportData()
    clearData()
};

document.getElementById('export').addEventListener('click', exportData);
document.getElementById('import').addEventListener('click', importData);
document.getElementById('reset').addEventListener('click', resetData);
document.getElementById('validate').addEventListener('click', validateData);