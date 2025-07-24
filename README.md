# My Chrome Extension

## Overview
This Chrome extension allows users to interact with items, stations, and dummies on a web page.
It includes features such as drag-and-drop, context menu actions, and local storage management.

## Features
- Drag and drop items and stations
- Create new stations and dummies
- Validate elements in HTML and local storage
- Change background and icons
- Check for errors in console logs

## Installation
1. Clone the repository:
    ```sh
    git clone https://github.com/yourusername/your-repo.git
    ```
2. Navigate to the project directory:
    ```sh
    cd your-repo
    ```
3. Install dependencies:
    ```sh
    npm install
    ```

## Usage
1. Load the extension in Chrome:
    - Open Chrome and navigate to `chrome://extensions/`
    - Enable "Developer mode" in the top right corner
    - Click "Load unpacked" and select the project directory

2. Run the tests:
    ```sh
    npm test
    ```

## Development
### Clearing Local Storage
To clear Chrome local storage, run the following script in the console:
```js
chrome.storage.local.clear(function() {
    var error = chrome.runtime.lastError;
    if (error) {
        console.error(error);
    }
    // do something more
});
chrome.storage.sync.clear();
```
##Viewing Local Storage
```js
chrome.storage.local.get(function(result) {
    console.log(result);
});
```
## License
Distributed under the MIT License. See `LICENSE` for more information.
```

