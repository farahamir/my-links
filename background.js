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

chrome.action.onClicked.addListener(function() {
  focusOrCreateTab('index.html');
});