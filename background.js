//adding new tab
function focusOrCreateTab(url) {
  chrome.tabs.query({}, function (tabs) {
    const matchingTab = tabs.find(tab => tab.url.includes(chrome.runtime.getURL(url)));
    if (matchingTab) {
      chrome.tabs.update(matchingTab.id, {"selected":true});
      return false;
    } else {
      chrome.tabs.create({url: url}).then(() => {});
    }
  });
}

chrome.runtime.onInstalled.addListener(()=> {
  chrome.runtime.getURL("index.html");
  focusOrCreateTab("index.html");
});

// The onClicked callback function.
function onClickHandler() {
  const manager_url = chrome.extension.getURL("index.html");
  focusOrCreateTab(manager_url);
}

chrome.contextMenus.onClicked.addListener(onClickHandler);

// Set up the context menu tree at installation time.
chrome.runtime.onInstalled.addListener(function() {
  // Create one item
  chrome.contextMenus.create({"title": "My Things", "contexts": ["page"], "id": "MyThings"});

});
chrome.action.onClicked.addListener(function() {
  focusOrCreateTab('index.html');
});