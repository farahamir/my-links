let initialUserData = {};
let currentView = "0";
let currentDrag = {};
const oneWeekAgo = new Date().getTime() - (1000 * 60 * 60 * 24 * 7);

function addToSearchResults(value, searchResults, resultsArray) {
    const result = document.createElement('ul');
    const newLink = document.createElement("a");
    const newImg = document.createElement("img");
    const titleSpan = document.createElement("span");
    const link = value.url ?? value.link;

    newImg.src = faviconURL(link);
    newImg.onerror = () => {
        newImg.src = faviconURLChrome(link);
    };
    newImg.alt = link;
    newImg.width = 32;
    newImg.height = 32;

    newLink.href = link;
    newLink.target = "_blank";
    newLink.style.display = "flex";
    newLink.style.alignItems = "center";
    newLink.style.gap = "8px";

    titleSpan.textContent = value.title ? value.title : link;
    titleSpan.style.marginLeft = "8px";

    newLink.appendChild(newImg);
    newLink.appendChild(titleSpan);
    result.appendChild(newLink);
    result.style.cursor = "pointer";
    result.tabIndex = 0; // Make the element focusable
    result.addEventListener('contextmenu', () => {});
    searchResults.appendChild(result);
    resultsArray.push(result); // Add to a result array
}

document.addEventListener('DOMContentLoaded', async function () {
    const overlay = document.getElementById('overlay');
    overlay.addEventListener('click', function (event) {
        hideAndRemovePopups(event);
    })
    //disable default mouse right click
    document.addEventListener('contextmenu', event => {
        event.preventDefault();
    });
    document.addEventListener('keyup', keyUpListener);
    const searchInput = document.getElementById("searchInput");
    //TODO reduce code
    searchInput.addEventListener('input', async () => {
        //show search results
        const searchResults = document.getElementById("searchResults");
        searchResults.innerHTML = '';
        showOverlay();
        //search in custom links
        const items = await chrome.storage.local.get();
        let currentIndex = -1; // Track the currently focused result
        const resultsArray = []; // Store references to result elements

        for (const [, value] of Object.entries(items)) {
            //show stations and items
            if ((value.type === "station" || value.type === "item" || value.type === "dummy")
                &&
                value.title && value.title.toLowerCase().includes(searchInput.value)) {
                //add stations or items
                const result = document.createElement('ul');
                const newImg = document.createElement("img");
                const titleSpan = document.createElement("span");
                newImg.src = value.icon;
                newImg.onerror = () => {
                    newImg.src = "images/default-link.webp"; // Fallback icon
                }
                newImg.style.height = '32px';
                newImg.style.width = '32px';
                titleSpan.textContent = value.title;
                titleSpan.style.marginLeft = "8px";
                result.appendChild(newImg);
                result.appendChild(titleSpan);
                result.style.cursor = "pointer";
                result.tabIndex = 0; // Make the element focusable
                result.addEventListener('click', async () => {
                    //go to view
                    const viewId = value.id.split(",")[0];
                    //reset current view
                    document.getElementById('panes').innerHTML = "";
                    document.getElementById('back-btn-div').innerHTML = "";
                    //load new view
                    const view = await chrome.storage.local.get("" + viewId);
                    await init(view["" + viewId]);
                });
                result.addEventListener('contextmenu', () => {});
                searchResults.appendChild(result);
                resultsArray.push(result); // Add to results array
            }
            //show links
            if ((value.link && value.link.includes(searchInput.value))) {
                addToSearchResults(value, searchResults, resultsArray);
            }
        }

        chrome.history.search({
            text: searchInput.value,
            startTime: oneWeekAgo,
            maxResults:1000
        }, function callback(historyItemsResult) {
            historyItemsResult
                .filter(value => !(value.url && value.url.startsWith("chrome-extension://")))
                .forEach(value => {
                    addToSearchResults(value, searchResults, resultsArray);
                });
        });
        chrome.readingList.query({}, function callback(items) {
            const filteredItems = items.filter(item =>
                (item.url && item.url.includes(searchInput.value)) ||
                (item.title && item.title.includes(searchInput.value))
            );
            filteredItems.forEach(value => {
                addToSearchResults(value, searchResults, resultsArray);
            });
        });

        chrome.bookmarks.search( searchInput.value, function callback(itemsResult)
        {
            const bookmarks = itemsResult.flatMap(item =>
                item.url ? [item] : (item.children ? extractBookmarks(item.children) : [])
            );
            bookmarks.forEach(value => {
                addToSearchResults(value, searchResults, resultsArray);
            });
        });

        chrome.tabs.query({}, async function (tabs) {
            const matchingTabs = tabs.filter(tab =>
                !(tab.url && tab.url.startsWith("chrome-extension://")) &&
                ((tab.url && tab.url.includes(searchInput.value)) ||
                (tab.title && tab.title.includes(searchInput.value)))
            );
            matchingTabs.forEach(value => {
                addToSearchResults(value, searchResults, resultsArray);
            });
        });

        // Add keyboard navigation
        searchInput.addEventListener('keydown', (event) => {
            if (event.key === "ArrowDown") {
                event.preventDefault();
                if (currentIndex < resultsArray.length - 1) {
                    if (currentIndex!==-1){
                        resultsArray[currentIndex].classList.remove("hovered");
                    }
                    currentIndex++;
                    resultsArray[currentIndex].classList.add("hovered");
                }
            } else if (event.key === "ArrowUp") {
                event.preventDefault();
                if (currentIndex > 0) {
                    if (currentIndex!==-1){
                        resultsArray[currentIndex].classList.remove("hovered");
                    }
                    currentIndex--;
                    resultsArray[currentIndex].classList.add("hovered");
                }
            } else if (event.key === "Enter" && currentIndex >= 0) {
                event.preventDefault();
                resultsArray[currentIndex].querySelector('a').click();
            }
        });
    })
    const result = await chrome.storage.local.get(["0"]);
    if (JSON.stringify(result) !== "{}") {
        await init(result["0"]);
    } else {
        const response = await fetch("MyThings.json");
        const json = await response.json();
        initialUserData = new Map(Object.entries(json));
        for (const [key, value] of initialUserData) {
            await chrome.storage.local.set({[key]: value});
            console.log(key + " is set");
        }
        await init(initialUserData.get("0")); // first run
    }
})

const keyUpListener = (event) => {
    if (event.which <= 90 && event.which >= 48) {//Allow only letters and numbers
        document.getElementById("overlay").style.display = "block";
        const keyValue = event.key;
        const searchInputDiv = document.getElementById("searchInputDiv");
        const searchInput = document.getElementById("searchInput");
        searchInputDiv.style.visibility = "visible";
        searchInput.value = keyValue;
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus();
        document.removeEventListener('keyup', keyUpListener);
    }
};

async function findItemAndRemoveFromStorage(itemId, linkId) {
    const result = await chrome.storage.local.get("" + itemId);
    const item = result["" + itemId];
    const linkIndex = linkId.split(",")[linkId.split(",").length - 1];
    const index = item.links.indexOf(parseInt(linkIndex));
    //remove from parent
    const x = item.links.splice(index, 1);
    await chrome.storage.local.set({[itemId]: item});
    console.log(itemId + " removed link " + x);
    await chrome.storage.local.remove("" + linkId);
    console.log(linkId + " Item was removed from storage");
}

async function removeLinkClickListener(linkId) {
    if (confirm("Are you sure Moving the Link To The Trash")) {
        const itemId = linkId.substring(0, linkId.lastIndexOf(","));
        document.getElementById(itemId + ",popup-content").removeChild(document.getElementById(linkId));
        hideCtxMenu()
        //get item id from storage
        //move a link to trash
        const result = await chrome.storage.local.get("trash");
        const trash = result["trash"];
        const linkIndex = trash.links ? trash.links.length : 0;
        const id = linkIndex > 0 ? trash.links[trash.links.length - 1] + 1 : 0;
        trash.links[linkIndex] = linkIndex > 0 ? id : 0;
        await chrome.storage.local.set({[trash.id]: trash});
        console.log(trash.id + " items has been updated");
        //store link in local storage
        const newTrashLinkId = trash.id + "," + id;
        const itemResult = await chrome.storage.local.get("" + linkId);
        const item = itemResult["" + linkId];
        const newLinkData = {
            id: newTrashLinkId,
            link: item.link,
            title: item.title
        };
        await chrome.storage.local.set({[newTrashLinkId]: newLinkData});
        console.log(newTrashLinkId + " has been added");
        const popup_content = document.getElementById(trash.id + ",popup-content");
        if (popup_content) {
            await addLinkInDialog(id, popup_content, trash.id);
        }
        await findItemAndRemoveFromStorage(itemId, linkId);
    }
}

async function removeLinksFromStorage(itemId, linkId) {
    //move a link to trash
    const trash = await chrome.storage.local.get("trash").then(result => result["trash"]);
    const linkIndex = trash.links ? trash.links.length : 0;
    const id = linkIndex > 0 ? trash.links[trash.links.length - 1] + 1 : 0;
    trash.links[linkIndex] = linkIndex > 0 ? id : 0;
    await chrome.storage.local.set({[trash.id]: trash});
    console.log(trash.id + " items has been updated");
    //store trash link in local storage
    const link = await chrome.storage.local.get("" + linkId).then(result => result["" + linkId]);
    const trashLinkId = trash.id + "," + id;
    const newLinkData = {
        id: trashLinkId,
        link: link.link,
        title: link.title
    };
    await chrome.storage.local.set({[trashLinkId]: newLinkData});
    console.log(trashLinkId + " has been added");
    const popup_content = document.getElementById(trash.id + ",popup-content");
    if (popup_content) {
        await addLinkInDialog(id, popup_content, trash.id);
    }
    //get item id from storage
    await findItemAndRemoveFromStorage(itemId, linkId);
}

function handleLinkCtMe(linkId, event) {
    const ctxData = [
        {id:"remLi",type:"click",fun:removeLinkClickListener,text:"Remove Link"}
    ]
    buildCtxMenu(ctxData, linkId, event);
}


function allowDrop(ev) {
    if (ev.target.id.includes(",s,") && currentDrag.id.includes("gifs")) {//GIF drag over station
        ev.preventDefault();
    } else if (ev.target.id.includes(",i,") && !currentDrag.id.includes("backgrounds")) {// not backgrounds drag over item
        ev.preventDefault();
    }
}

function backgroundAllowDrop(ev) {
    if (currentDrag.id && currentDrag.id.includes("background")) {
        ev.preventDefault();
    }
}

function dragStart(ev) {
    const format = "url";
    const formatValue = ev.currentTarget.alt;
    hideOverlay();
    setDataStartDrag(ev, format, formatValue);
}

function gifsDragStart(ev, format, formatValue) {
    hideOverlay();
    setDataStartDrag(ev, format, formatValue);
}

function backgroundDragStart(ev, format, formatValue) {
    hideOverlay();
    setDataStartDrag(ev, format, formatValue);
}

function setDataStartDrag(ev, format, formatValue) {
    ev.dataTransfer.setData(format, formatValue);
    ev.dataTransfer.setData("title", ev.currentTarget.parentNode.title);
    ev.dataTransfer.setData("id", ev.currentTarget.parentElement.id);
    currentDrag.id = ev.currentTarget.parentElement.id;
    currentDrag.title = ev.currentTarget.parentNode.title;
    currentDrag.link = ev.currentTarget.src;
}

function hideOverlay() {
    document.getElementById('overlay').style.display = 'none';
}

function dragEnd(ev) {
    ev.preventDefault();
    if (ev.dataTransfer.dropEffect === "none") {
        document.getElementById('overlay').style.display = 'block';
    }
    currentDrag = {};
}

async function drop(ev) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData("id");
    const url = ev.dataTransfer.getData("url");
    if (id.includes("gifs")) {
        const iconImg = document.getElementById(ev.target.id);
        iconImg.src = url;
        iconImg.alt = url;
        //update item in storage
        const itemId = ev.target.id.replace(",img", "");
        const result = await chrome.storage.local.get([itemId]);
        const item = result[itemId];
        item.icon = url;
        await chrome.storage.local.set({[item.id]: item});
        console.log("updated icon of item id " + item.id);
        const gifs_popup = document.getElementById('gifs-popup');
        const overlay = document.getElementById('overlay');
        overlay.style.display = 'none';
        if (gifs_popup) {
            document.body.removeChild(gifs_popup);
        }
    } else {
        const urlTitle = ev.dataTransfer.getData("title");
        const itemId = ev.target.id.replace(",img", "");
        const popup_content = document.getElementById(itemId + ",popup-content");
        const result = await chrome.storage.local.get(itemId.toString());
        await addLinkToItem(result[itemId], url, urlTitle, popup_content);
        const open_tabs_popup = document.getElementById('open-tabs-popup');
        const bookmarks_popup = document.getElementById('bookmarks-popup');
        const trash_popup = document.getElementById('trash-popup');
        const history_popup = document.getElementById('history-popup');
        const reading_list_popup = document.getElementById('reading-list-popup');
        const overlay = document.getElementById('overlay');
        overlay.style.display = 'none';
        if (open_tabs_popup) {
            document.body.removeChild(open_tabs_popup);
        }
        if (bookmarks_popup) {
            document.body.removeChild(bookmarks_popup);
        }
        if (history_popup) {
            document.body.removeChild(history_popup);
        }
        if (trash_popup) {
            document.body.removeChild(trash_popup);
        }
        if (reading_list_popup) {
            document.body.removeChild(reading_list_popup);
        }
    }
    currentDrag = {};
}

function drawCanvasImage(ctxBg, img) {
    ctxBg.drawImage(img, 0, 0, window.innerWidth, window.innerHeight);
}

async function backgroundDrop(ev) {
    ev.preventDefault();
    const url = decodeURI(ev.dataTransfer.getData("link"));
    background = document.getElementById("background");
    background.width = window.innerWidth;
    background.height = window.innerHeight;
    let ctxBg = background.getContext('2d');
    const img = new Image;
    img.src = url;
    img.onload = () => {
        drawCanvasImage(ctxBg, img);
    };

    //update item in storage
    const result = await chrome.storage.local.get([currentView]);
    const item = result[currentView];
    item.background = url;
    await chrome.storage.local.set({[item.id]: item});
    console.log("updated background of item id " + item.id);
    const backgrounds_popup = document.getElementById('backgrounds-popup');
    const overlay = document.getElementById('overlay');
    overlay.style.display = 'none';
    if (backgrounds_popup) {
        document.body.removeChild(backgrounds_popup);
    }
    currentDrag = {};
}

function addLinksToHistory(results, popup_content) {
for (const historyItem of results) {
    const link = historyItem.url;
    if (!link.includes("chrome-extension://")) {
        const newLink = document.createElement("a");
        const newImg = document.createElement("img");
        newImg.src = faviconURL(historyItem.url);
        newImg.onerror = () => {
            newImg.src = faviconURLChrome(historyItem.url);
        }
        newImg.alt = link;
        newImg.width = 32;
        newImg.height = 32;
        newImg.loading = "lazy";
        newLink.href = link;
        newLink.title = historyItem.title;
        newLink.target = "_blank";
        newLink.link = historyItem.url;
        newLink.appendChild(newImg);
        newImg.addEventListener('dragstart', function (dragEvent) {
            dragStart(dragEvent)
        }, false);
        newImg.addEventListener("dragend", function (dragEvent) {
            dragEnd(dragEvent)
        }, false);
        newLink.addEventListener("contextmenu", function (event) {
            handleLinkCtMe(newLink, event);
        }, false);
        popup_content.appendChild(newLink);
    }
}}

//image to change
let imageToChange;

let background;

function bookmarkFolder(children, popup_content,faviconChrome) {
    for (const bookmark of children) {
        if (bookmark.url) {
            const link = bookmark.url;
            const newLink = document.createElement("a");
            const newImg = document.createElement("img");
            newImg.src = faviconChrome?faviconURLChrome(bookmark.url):faviconURL(bookmark.url);
            newImg.onerror = () => {
                newImg.src = faviconURLChrome(bookmark.url);
            }
            newImg.width = 32;
            newImg.height = 32;
            newImg.loading = "lazy";
            newImg.alt = link;
            newLink.href = link;
            newLink.title = bookmark.title;
            newLink.target = "_blank";
            newLink.id = "bookmark," + bookmark.id;
            newLink.link = bookmark.url;
            newLink.appendChild(newImg);
            newLink.addEventListener("click", function (event) {
                event.preventDefault();
                chrome.tabs.query({}, function (tabs) {
                    const matchingTab = tabs.find(tab => tab.url === link);
                    if (matchingTab) {
                        chrome.tabs.highlight({tabs: matchingTab.index}, function () {
                            console.log("hide");
                        })
                        return false;
                    } else {
                        chrome.tabs.create({url: link}).then(r => {
                        });
                    }
                });

            }, false);
            newImg.addEventListener('dragstart', function (dragEvent) {
                dragStart(dragEvent)
            }, false);
            newImg.addEventListener("dragend", function (dragEvent) {
                dragEnd(dragEvent)
            }, false);

            newLink.addEventListener("contextmenu", function (event) {
                handleBookmarksLinkCtMe(event, newLink);
            }, false);
            popup_content.appendChild(newLink);
        } else {//folder
            bookmarkFolder(bookmark.children, popup_content,faviconChrome);
        }
    }
}

function handleBookmarksLinkCtMe(event, newLink) {
    const ctxData = [
        {id: "cpyUrl", type: "click", fun: copyUrlClickListener, text: "Copy Url"},
        {id: "remLi", type: "click", fun: removeBookLinkClickListener, text: "Remove Link"}
    ]
    buildCtxMenu(ctxData, newLink, event);
}

async function removeBookLinkClickListener(newLink) {
    if (confirm("Are you sure Moving the Link To The Trash?")) {
        const itemId = newLink.id.replace("bookmark,", "");
        document.getElementById("bookmarks,popup-content").removeChild(document.getElementById(newLink.id));
        hideCtxMenu()
        //remove item from bookmarks
        await chrome.bookmarks.remove("" + itemId);
        console.log(itemId + " Bookmark was removed from The Bookmarks");
        //move a link to trash        //move a link to trash
        const result = await chrome.storage.local.get("trash");
        const trash = result["trash"];
        const linkIndex = trash.links ? trash.links.length : 0;
        const id = linkIndex > 0 ? trash.links[trash.links.length - 1] + 1 : 0;
        trash.links[linkIndex] = linkIndex > 0 ? id : 0;
        await chrome.storage.local.set({[trash.id]: trash});
        console.log(trash.id + " items has been updated");
        //store link in local storage
        const linkId = trash.id + "," + id;
        const newLinkData = {
            id: linkId,
            link: newLink.link,
            title: newLink.title
        };
        await chrome.storage.local.set({[linkId]: newLinkData});
        console.log(linkId + " has been added");
        const popup_content = document.getElementById(trash.id + ",popup-content");
        if (popup_content) {
            await addLinkInDialog(id, popup_content, trash.id);
        }
    }
}

async function init(root) {
    currentView = root.id;
    background = document.getElementById("background");
    background.addEventListener("drop", backgroundDrop)
    background.addEventListener("dragover", backgroundAllowDrop)
    background.width = window.innerWidth;
    background.height = window.innerHeight;
    background.addEventListener("contextmenu", function (event) {
        handleBckGrCtMe(root, event)
    }, false);
    background.addEventListener("click", function () {
        hideCtxMenu();
    }, false);
    const img = new Image;
    img.src = root.background;
    let ctxBg = background.getContext('2d');
    img.onload = async () => {
        await drawCanvasImage(ctxBg, img);
        const panes = document.getElementById('panes');
        //adding panes
        //  - adding stations
        for (const stationId of root.stations) {
            const station = await chrome.storage.local.get(root.id + "," + stationId + ",s");
            await populatePanes(station[root.id + "," + stationId + ",s"], panes);
        }
        //  - adding items
        for (const itemId of root.items) {
            const item = await chrome.storage.local.get(root.id + "," + itemId + ",i");
            await populatePanes(item[root.id + "," + itemId + ",i"], panes);
        }
        //  - adding dummies
        for (const dummyId of root.dummies) {
            const item = await chrome.storage.local.get(root.id + "," + dummyId + ",d");
            await populatePanes(item[root.id + "," + dummyId + ",d"], panes);
        }
        //  -   adding back button
        const backBtnClick = async () => {
            const black_screen = $('#black-screen');
            black_screen.show();
            black_screen.fadeOut();

            //reset current view
            document.getElementById('panes').innerHTML = "";
            document.getElementById('back-btn-div').innerHTML = "";
            //load new view
            const view = await chrome.storage.local.get("" + root.parent);
            await init(view["" + root.parent]);
        };
        //  - back button handle
        if (root.parent >= 0) {
            //create back button
            const bckBtnDiv = document.getElementById("back-btn-div");
            const back_btn = document.createElement("img");
            back_btn.id = "back-btn";
            back_btn.src = "images/back.png";
            back_btn.alt = "back";
            bckBtnDiv.appendChild(back_btn);
            document.body.appendChild(bckBtnDiv);
            back_btn.style.display = "block";
            back_btn.addEventListener('click', backBtnClick);
        }
    };


}

function preventGoingOutsideWindow(contextMenuDiv) {
    if (contextMenuDiv.getBoundingClientRect().right > window.innerWidth) {
        contextMenuDiv.style.left = (window.innerWidth - contextMenuDiv.getBoundingClientRect().width - 10) + "px";
    }
    if (contextMenuDiv.getBoundingClientRect().bottom > window.innerHeight) {
        contextMenuDiv.style.top = (window.innerHeight - contextMenuDiv.getBoundingClientRect().height - 10) + "px";
    }
    if (contextMenuDiv.getBoundingClientRect().top < 0) {
        contextMenuDiv.style.top = "10px";
    }
    if (contextMenuDiv.getBoundingClientRect().left < 0) {
        contextMenuDiv.style.left = "10px";
    }
}

function buildCtxMenuDiv(contextMenuDiv, event) {
    contextMenuDiv.id = "contextMenu";
    contextMenuDiv.className = "context-menu";
    contextMenuDiv.style.display = "block";
    contextMenuDiv.style.zIndex = "1001";
    contextMenuDiv.style.left = (event.pageX + 10) + "px";
    contextMenuDiv.style.top = (event.pageY - 50) + "px";
    document.body.appendChild(contextMenuDiv);
    preventGoingOutsideWindow(contextMenuDiv);
}

function handleBckGrCtMe(root, event) {
    hideCtxMenu();
    document.removeEventListener('keyup', keyUpListener);
    const contextMenuDiv = document.createElement("div");
    const contextMenuUl = document.createElement("ul");
    contextMenuUl.appendChild(createTitleInputMenuItemWithInput("adStBtn","adStInp","Station",root.id,addStClickListener));
    contextMenuUl.appendChild(createTitleInputMenuItemWithInput("adItBtn","adItInp","Item",root.id,addItClickListener));
    contextMenuUl.appendChild(createTitleInputMenuItemWithInput("adDumBtn","adDumInp","Dummy",root.id,addDumClickListener));
    contextMenuUl.appendChild(createMenuItem("chgBck", `Change Background`, changBackgroundClickListener));
    contextMenuUl.appendChild(createMenuItem("shTab", `Open Tabs`, showTabsClickListener));
    contextMenuUl.appendChild(createMenuItem("shTrash", `Trash`, showTrashClickListener));
    contextMenuUl.appendChild(createMenuItem("shHist", `History`, showHistClickListener));
    contextMenuUl.appendChild(createMenuItem("shGifs", `Gifs`, showGifsClickListener));
    contextMenuUl.appendChild(createMenuItem("shBckg", `Backgrounds`, showBackgroundsClickListener));
    contextMenuUl.appendChild(createMenuItem("shBok", `Bookmarks`, showBookmarksClickListener));
    contextMenuUl.appendChild(createMenuItem("shRdngLst", `Reading List`, showReadingListClickListener));
    contextMenuDiv.appendChild(contextMenuUl);
    buildCtxMenuDiv(contextMenuDiv, event);
    imageToChange = "background";
}

function openTabListener(link) {
    return function (event) {
        event.preventDefault();
        chrome.tabs.query({}, async function (tabs) {
            const matchingTab = tabs.find(tab => tab.url === link);
            if (matchingTab) {
                chrome.tabs.highlight({tabs: matchingTab.index}, function () {
                    console.log("focusing on tab index "+matchingTab.index);
                })
                return false;
            } else {
                await chrome.tabs.create({url: link});
            }
        });

    };
}

function showOverlay() {
    document.getElementById('overlay').style.display = 'block';
}

function adjustDialogInWindow(dialog) {
    if (dialog.getBoundingClientRect().left < 0) {
        dialog.style.left = (parseInt(dialog.style.left.replace("px", "")) - dialog.getBoundingClientRect().left) + "px";
    }
    if (dialog.getBoundingClientRect().bottom > window.innerHeight) {
        dialog.style.top = (window.innerHeight - dialog.getBoundingClientRect().height - 10) + "px";
    }
}

function populateHistoryDialogBox(uniqueHistoryItemsByTitle, popup_content,faviconChrome) {
    for (const historyItem of Object.values(uniqueHistoryItemsByTitle)) {
        const link = historyItem.url;
        if (!link.includes("chrome-extension://") && !link.includes("data:,") && !link.includes("about:")) {
            const newLink = document.createElement("a");
            const newImg = document.createElement("img");
            newImg.src = faviconChrome?faviconURLChrome(historyItem.url):faviconURL(historyItem.url);
            newImg.onerror = () => {
                newImg.src = faviconURLChrome(historyItem.url);
            }
            newImg.loading = "lazy";
            newImg.width = 32;
            newImg.height = 32;
            newImg.alt = link;
            newLink.href = link;
            newLink.title = historyItem.title;
            newLink.target = "_blank";
            newLink.id = "history," + historyItem.id;
            newLink.appendChild(newImg);
            newLink.addEventListener("click", openTabListener(link), false);
            newImg.addEventListener('dragstart', dragEvent => {
                dragStart(dragEvent)
            }, false);
            newImg.addEventListener("dragend", dragEvent => {
                dragEnd(dragEvent)
            }, false);
            newLink.addEventListener("contextmenu", function (event) {
                handleHistoryLinkCtMe(historyItem, event);
            }, false);
            popup_content.appendChild(newLink);
        }
    }
}
function handleHistoryLinkCtMe(historyItem, event) {
    const ctxData = [
        {id: "cpyUrl", type: "click", fun: copyUrlClickListener, text: "Copy Url"}
    ]
    buildCtxMenu(ctxData, historyItem, event);
}
function createHistoryDialogBox(event, uniqueHistoryItemsByTitle, faviconChrome) {
    createDialogBox(event, "History", "history", (dialog, dialog_content) => {
        populateHistoryDialogBox(uniqueHistoryItemsByTitle, dialog_content, faviconChrome);
        const search_input = document.createElement("input");
        const switchToggle = createToggleSwitch("history", faviconChrome, async (newFaviconChrome) => {
            dialog_content.innerHTML = "";
            populateHistoryDialogBox(uniqueHistoryItemsByTitle, dialog_content, newFaviconChrome);
        });
        dialog.appendChild(search_input);
        dialog.appendChild(switchToggle);
        search_input.focus();
        search_input.addEventListener("input", function () {
            document.removeEventListener('keyup', keyUpListener);
            dialog_content.innerHTML = "";
            if (search_input.value) {
                chrome.history.search({
                    text: search_input.value,
                    startTime: oneWeekAgo,
                    maxResults:1000
                }, function callback(historyItemsResult) {
                    addLinksToHistory(historyItemsResult, dialog_content);
                });
            } else {
                populateHistoryDialogBox(uniqueHistoryItemsByTitle, dialog_content, faviconChrome);
            }
        });
    });
}
function createBookmarksDialogBox(event, tree,faviconChrome) {
    createDialogBox(event, "Bookmarks", "bookmarks", (dialog, dialog_content) => {
        bookmarkFolder(tree, dialog_content,faviconChrome);
        const search_input = document.createElement("input");
        const switchToggle = createToggleSwitch("bookmarks", faviconChrome, (newFaviconChrome) => {
            dialog_content.innerHTML = "";
            if (search_input.value) {
                chrome.bookmarks.search( search_input.value, function callback(itemsResult)
                {
                    bookmarkFolder(itemsResult, dialog_content,newFaviconChrome);
                });
            } else {
                bookmarkFolder(tree, dialog_content,newFaviconChrome);
            }
        });
        dialog.appendChild(search_input);
        dialog.appendChild(switchToggle);
        search_input.focus();
        search_input.addEventListener("input", async function () {
            const result = await chrome.storage.local.get("bookmarks")
            const faviconChrome = /^true$/i.test(result.bookmarks.faviconChrome);
            document.removeEventListener('keyup', keyUpListener);
            dialog_content.innerHTML = "";
            if (search_input.value) {
                chrome.bookmarks.search( search_input.value, function callback(itemsResult)
                {
                    bookmarkFolder(itemsResult, dialog_content,faviconChrome);
                });
            } else {
                bookmarkFolder(tree, dialog_content,faviconChrome);
            }
        });
    });
}
function createReadingListDialogBox(event, items,faviconChrome) {
    createDialogBox(event, "ReadingList", "reading-list", (dialog,dialog_content) => {
        populateReadingListDialogBox(items, dialog_content,faviconChrome);
        const search_input = document.createElement("input");
        const switchToggle = createToggleSwitch("readingList", faviconChrome, async (newFaviconChrome) => {
            dialog_content.innerHTML = "";
            if (search_input.value) {
                chrome.readingList.query({}, function callback(items) {
                    const filteredItems = items.filter(item =>
                        (item.url && item.url.includes(search_input.value)) ||
                        (item.title && item.title.includes(search_input.value))
                    );
                    populateReadingListDialogBox(filteredItems, dialog_content,newFaviconChrome);
                });
            } else {
                populateReadingListDialogBox(items, dialog_content,newFaviconChrome);
            }
        });
        dialog.appendChild(search_input);
        dialog.appendChild(switchToggle);
        search_input.focus();
        search_input.addEventListener("input", async function () {
            const result = await chrome.storage.local.get("readingList")
            const faviconChrome = /^true$/i.test(result.readingList.faviconChrome);
            document.removeEventListener('keyup', keyUpListener);
            dialog_content.innerHTML = "";
            if (search_input.value) {
                chrome.readingList.query({}, function callback(items) {
                    const filteredItems = items.filter(item =>
                        (item.url && item.url.includes(search_input.value)) ||
                        (item.title && item.title.includes(search_input.value))
                    );
                    populateReadingListDialogBox(filteredItems, dialog_content,faviconChrome);
                });
            } else {
                populateReadingListDialogBox(items, dialog_content,faviconChrome);
            }
        });

    });
}
function createOpenTabsDialogBox(event, tabs, faviconChrome) {
    createDialogBox(event, "Open-Tabs", "open-tabs", (dialog, dialog_content) => {
        populateOpenTabsDialogBox(tabs, dialog_content, faviconChrome);
        const search_input = document.createElement("input");
        const switchToggle = createToggleSwitch("openTabs", faviconChrome, async (newFaviconChrome) => {
            dialog_content.innerHTML = "";
            populateOpenTabsDialogBox(tabs, dialog_content, newFaviconChrome);
        });
        dialog.appendChild(search_input);
        dialog.appendChild(switchToggle);
        search_input.focus();
        search_input.addEventListener("input", function () {
            document.removeEventListener('keyup', keyUpListener);
            dialog_content.innerHTML = "";
            populateOpenTabsDialogBox(tabs, dialog_content, faviconChrome);
        });
    });
}
function createToggleSwitch(storageKey, faviconChrome, onChangeCallback) {
    const switchToggle = document.createElement("label");
    const slider = document.createElement("span");
    const toggle = document.createElement("input");
    switchToggle.className = "switch";
    toggle.type = "checkbox";
    toggle.id = "toggleSwitch";
    slider.className = "slider";
    switchToggle.appendChild(toggle);
    switchToggle.appendChild(slider);
    switchToggle.title = `Using faviconChrome: ${faviconChrome}`;
    toggle.checked = faviconChrome;
    toggle.addEventListener("change", async () => {
        const result = await chrome.storage.local.get(storageKey);
        const faviconChrome = /^true$/i.test(result[storageKey].faviconChrome);
        const newFaviconChrome = !faviconChrome;
        switchToggle.title = `Using faviconChrome: ${newFaviconChrome}`;
        const storageData = result[storageKey];
        storageData["faviconChrome"] = "" + newFaviconChrome;
        await chrome.storage.local.set({ [storageKey]: storageData });
        console.log(`Updated faviconChrome of ${storageKey} to ${newFaviconChrome}`);
        onChangeCallback(newFaviconChrome);
    });
    return switchToggle;
}


async function showHistClickListener(event) {
    document.removeEventListener('keyup', keyUpListener);
    hideCtxMenu()
    const result = await chrome.storage.local.get("history")
    const faviconChrome = /^true$/i.test(result.history.faviconChrome);
    chrome.history.search({
        text: '',
        startTime: oneWeekAgo,
        maxResults:1000
    }, async function callback(historyItemResults) {
        const uniqueHistoryItemsByTitle = {};
        for (const historyItem of historyItemResults) {
            if (!uniqueHistoryItemsByTitle.hasOwnProperty(historyItem.title)) {
                uniqueHistoryItemsByTitle[historyItem.title] = historyItem;
            }
        }
        createHistoryDialogBox(event, uniqueHistoryItemsByTitle, faviconChrome);
    });
}

async function populateTrashDialogBox(trashLinks, result, popup_content) {
    for (const trashId of trashLinks) {
        //adding links
        const linkId = result["trash"].id + "," + trashId;
        const linkResult = await chrome.storage.local.get(linkId);
        const trashItem = linkResult[linkId];
        const newLink = document.createElement("a");
        const newImg = document.createElement("img");
        newImg.src = faviconURL(trashItem.link);
        newImg.onerror = () => {
            newImg.src = faviconURLChrome(trashItem.url);
        }
        newImg.loading = "lazy";
        newImg.alt = trashItem.link;
        newImg.height = 32;
        newImg.width = 32;
        newLink.href = trashItem.link;
        newLink.title = trashItem.title;
        newLink.target = "_blank";
        newLink.appendChild(newImg);
        newImg.addEventListener('dragstart', function (dragEvent) {
            dragStart(dragEvent)
        }, false);
        newImg.addEventListener("dragend", function (dragEvent) {
            dragEnd(dragEvent)
        }, false);

        function handleLinkCtMe(linkId, event) {
            const ctxData = [
                {id: "cpyUrl", type: "click", fun: copyUrlClickListener, text: "Copy Url"},
                {id: "remLi", type: "click", fun: removeLinkClickFromTrashListener, text: "Remove Link"}
            ]
            buildCtxMenu(ctxData, linkId, event);
        }

        newLink.addEventListener("contextmenu", function (event) {
            handleLinkCtMe(linkId, event);
        }, false);
        popup_content.appendChild(newLink);
    }
}

async function createTrashDialogBox(event, trashLinks, result) {
    createDialogBox(event, "Trash", "trash", async (dialog,dialog_content) => {
        await populateTrashDialogBox(trashLinks, result, dialog_content);
    });
}

async function showTrashClickListener(event) {
    hideCtxMenu()
    const result = await chrome.storage.local.get("trash");
    //create a dialog with trash urls
    const trashLinks = result["trash"].links;
    await createTrashDialogBox(event, trashLinks, result);

}
async function removeLinkClickFromTrashListener(linkId) {
    const itemId = linkId.substring(0, linkId.lastIndexOf(","));
    document.getElementById(itemId + ",popup-content").removeChild(document.getElementById(linkId));
    hideCtxMenu()
    //get item id from storage
    await findItemAndRemoveFromStorage(itemId, linkId);
}
function mouseOverListener(mouseOverEvent, newImg) {
    const tooltip = document.createElement("div");
    tooltip.id = "gifsTooltip";
    tooltip.style.position = "fixed";
    tooltip.style.backgroundColor = "white";
    tooltip.style.border = "1px solid black";
    tooltip.style.padding = "5px";
    tooltip.style.zIndex = "1005";
    tooltip.style.top = mouseOverEvent.pageY + "px";
    tooltip.style.left = mouseOverEvent.pageX + "px";
    const img = document.createElement("img");
    img.src = newImg.src;
    img.onerror = () => {
        newImg.src = "images/default-link.webp";
    };
    img.style.width = "100px";
    img.style.height = "100px";
    tooltip.appendChild(img);
    document.body.appendChild(tooltip);

    newImg.addEventListener("mouseout", function () {
        document.body.removeChild(tooltip);
    }, {once: true});
}

async function populateGifsDialogBox(gifLinks, result, popup_content) {
    for (const linkIndex of gifLinks) {
        const linkId = result["gifs"].id + "," + linkIndex;
        const linkResult = await chrome.storage.local.get(linkId);
        const linkItem = linkResult[linkId];
        if(linkItem)
        {
            const link = linkItem.link;
            const newLink = document.createElement("a");
            const newImg = document.createElement("img");
            newImg.src = link;
            newImg.onerror = () => {
                newImg.src = "images/default-link.webp";
            };
            newImg.alt = link;
            newImg.width = 32;
            newImg.height = 32;
            newLink.href = link;
            newLink.title = linkItem.title ? linkItem.title : link;
            newLink.target = "_blank";
            newLink.id = linkId;
            newLink.appendChild(newImg);
            newImg.addEventListener('dragstart', function (dragEvent) {
                const format = "url";
                const formatValue = dragEvent.currentTarget.src;
                gifsDragStart(dragEvent, format, formatValue)
            }, false);
            newImg.addEventListener("dragend", function (dragEvent) {
                dragEnd(dragEvent)
            }, false);
            newImg.addEventListener("mouseover", function (mouseOverEvent) {
                mouseOverListener(mouseOverEvent, newImg);
            }, false);
            newLink.addEventListener("contextmenu", function (event) {
                handleLinkCtMe(linkId, event);
            }, false);
            popup_content.appendChild(newLink);
        }
    }
}

async function populateBackgroundsDialogBox(backgroundLinks, result, popup_content,viewId) {
    for (const linkIndex of backgroundLinks) {
        const linkId = result["backgrounds"].id + "," + linkIndex;
        const linkResult = await chrome.storage.local.get(linkId);
        const linkItem = linkResult[linkId];
        const link = linkItem.link;
        const newLink = document.createElement("a");
        const newImg = document.createElement("img");
        newImg.src = link;
        newImg.onerror = () => {
            newImg.src = "images/default-link.webp";
        };
        newImg.alt = link;
        newImg.width = 32;
        newImg.height = 32;
        newLink.href = link;
        newLink.title = linkItem.title ? linkItem.title : link;
        newLink.target = "_blank";
        newLink.id = linkId;
        newLink.appendChild(newImg);
        newImg.addEventListener('dragstart', function (dragStartEvent) {
            const format = "link";
            const formatValue = dragStartEvent.currentTarget.src;
            backgroundDragStart(dragStartEvent, format, formatValue)
        }, false);
        newImg.addEventListener("dragend", dragEnd, false);
        newImg.addEventListener("mouseover", function (mouseOverEvent) {
            mouseOverListener(mouseOverEvent, newImg)
        }, false);
        newLink.addEventListener("contextmenu", function (event) {
            handleLinkCtMe(linkId, event);
        }, false);
        if (viewId){
            newLink.addEventListener("click", async function (event) {
                event.preventDefault();
                const background = document.getElementById("background");
                //update dom element with the new image
                background.width = window.innerWidth;
                background.height = window.innerHeight;
                let ctxBg = background.getContext('2d');
                const img = new Image;
                img.src = event.target.src;
                img.onload = () => {
                    drawCanvasImage(ctxBg, img);
                };

                //hide background_popup
                const background_popup = document.getElementById('background-popup');
                const overlay = document.getElementById('overlay');
                overlay.style.display = 'none';
                if (background_popup) {
                    document.body.removeChild(background_popup);
                }
                //update storage
                await updateItemIconStorage(viewId, event);
            });
        }
        popup_content.appendChild(newLink);
    }
}

async function createBackgroundsDialogBox(event, result, backgroundLinks,viewId) {
    createDialogBox(event, "Backgrounds", "backgrounds",  (dialog, dialog_content) => {
        populateBackgroundsDialogBox(backgroundLinks, result, dialog_content,viewId);
        const addNewLinkBtn = document.createElement("button");
        addNewLinkBtn.id = "add-new-link-btn";
        addNewLinkBtn.innerHTML = "Add New Link";
        const newUrlTitleInput = document.createElement("input");
        newUrlTitleInput.type = "text";
        const newUrlTitleLabel = document.createElement("label");
        newUrlTitleLabel.innerHTML = "Url Title";
        const newUrlInput = document.createElement("input");
        newUrlInput.id = "new-link-inp";
        newUrlInput.type = "text";
        newUrlInput.minLength = 8;
        newUrlInput.maxLength = 500;
        newUrlInput.size = 30;
        dialog.appendChild(addNewLinkBtn);
        dialog.appendChild(newUrlInput);
        dialog.appendChild(newUrlTitleLabel);
        dialog.appendChild(newUrlTitleInput);
        newUrlInput.focus();
        addNewLinkBtn.addEventListener("click", function () {
            addNewGifListener(newUrlTitleInput, dialog_content);
        }, false);
    });
}

async function showBackgroundsClickListener(event,viewId) {
    hideCtxMenu()
    document.removeEventListener('keyup', keyUpListener);
    const result = await chrome.storage.local.get("backgrounds");
    //create popup with Backgrounds urls
    const backgroundLinks = result["backgrounds"].links;
    await createBackgroundsDialogBox(event, result, backgroundLinks,viewId);
}

//TODO dup
async function addStClickListener(rootId, event, itemAddStationTitleInput) {
    const root = await chrome.storage.local.get("" + rootId).then(result => result["" + rootId]);
    //generate new id from the last one + 1
    const newId = root.stations.length > 0 ? root.stations[root.stations.length - 1] + 1 : 0;
    //get last station id
    const result = await chrome.storage.local.get("lastStationViewId");
    const lastStationViewId = (result["lastStationViewId"].viewId.length === 0) ? 0 : result["lastStationViewId"].viewId[result["lastStationViewId"].viewId.length - 1];
    const newViewId = lastStationViewId + 1;
    //create a new station object
    const newStationId = root.id + "," + newId + ",s";
    const newStationData = {};
    newStationData["id"] = newStationId;
    newStationData["icon"] = "images/yellow big house.png";
    newStationData["left"] = (event.pageX - 10) + "px";
    newStationData["top"] = (event.pageY - 10) + "px";
    newStationData["height"] = "64px";
    newStationData["width"] = "64px";
    newStationData["target"] = newViewId;
    newStationData["type"] = "station";
    newStationData["title"] = itemAddStationTitleInput.value;
    newStationData["view"] = root.id;
    populatePanes(newStationData, panes);
    hideCtxMenu()
    //save the new station and last new station id to local storage
    result["lastStationViewId"].viewId[result["lastStationViewId"].viewId.length] = newViewId;
    await chrome.storage.local.set({["lastStationViewId"]: result["lastStationViewId"]});
    console.log("lastStationViewId is updated with " + newViewId);

    root.stations[root.stations.length] = newId;
    await chrome.storage.local.set({[root.id]: root});
    console.log(root.id + " is updated");
    //add a new station to the local storage
    await chrome.storage.local.set({[newStationId]: newStationData});
    console.log(newStationId + " is added");
    //create a new view and store it
    const newViewData = {
        id: "" + newViewId,
        background: "images/living-room-animation.jpg",
        stations: [],
        items: [],
        dummies: [],
        parent: "" + root.id,
    };
    await chrome.storage.local.set({[newViewId]: newViewData});
    console.log(newViewId + " is added");

}
//TODO dup
async function addItClickListener(rootId, event, itemAddItemTitleInput) {
    //Get object root.id from storage
    const root = await chrome.storage.local.get("" + rootId).then(result => result["" + rootId]);
    //generate id from the last one + 1
    const newId = root.items.length > 0 ? root.items[root.items.length - 1] + 1 : 0;
    //get last Item id
    const newItemId = root.id + "," + newId + ",i";
    //create new item
    const newItemData = {};
    newItemData["id"] = newItemId;
    newItemData["icon"] = "images/folder.png";
    newItemData["left"] = (event.pageX - 10) + "px";
    newItemData["top"] = (event.pageY - 10) + "px";
    newItemData["height"] = "64px";
    newItemData["width"] = "64px";
    newItemData["links"] = [];
    newItemData["type"] = "item";
    newItemData["title"] = itemAddItemTitleInput.value;
    newItemData["view"] = root.id;
    newItemData["faviconChrome"] = "false";
    await populatePanes(newItemData, panes);//FIX
    hideCtxMenu()
    //save the new station to local storage
    //update items of the root object
    root.items[root.items.length] = newId;
    await chrome.storage.local.set({[root.id]: root});
    console.log(root.id + " is updated");
    //add new item to the local storage
    await chrome.storage.local.set({[newItemId]: newItemData});
    console.log(newItemId + " is added");
}
//TODO dup
async function addDumClickListener(rootId, event, itemAddDummyTitleInput) {
    const root = await chrome.storage.local.get("" + rootId).then(result => result["" + rootId]);
    //generate id from the last one + 1
    const newId = root.dummies.length > 0 ? root.dummies[root.dummies.length - 1] + 1 : 0;
    //get last Item id
    const newDummyId = root.id + "," + newId + ",d";
    //create new item
    const newDummyData = {};
    newDummyData["id"] = newDummyId;
    newDummyData["icon"] = "images/dummy.png";
    newDummyData["left"] = (event.pageX - 10) + "px";
    newDummyData["top"] = (event.pageY - 10) + "px";
    newDummyData["height"] = "64px";
    newDummyData["width"] = "64px";
    newDummyData["type"] = "dummy";
    newDummyData["title"] = itemAddDummyTitleInput.value;
    newDummyData["view"] = root.id;
    await populatePanes(newDummyData, panes);
    hideCtxMenu()
    //save the new station to local storage
    //update items of the root object
    root.dummies[root.dummies.length] = newId;
    await chrome.storage.local.set({[root.id]: root});
    console.log(root.id + " is updated");
    //add new item to the local storage
    await chrome.storage.local.set({[newDummyId]: newDummyData});
    console.log(newDummyId + " is added");
}

async function changBackgroundClickListener(event) {
    hideCtxMenu()
    //create popup with input for the background and change button
    /* const saveBtn = recreateChBgDialog(event.currentTarget.id);
     saveBtn.addEventListener("click", async function () {
         const new_bck_inp = document.getElementById("new-bck-inp");
         if (new_bck_inp.value !== "" && backgroundId) {
             img.src = new_bck_inp.value;
             img.onload = () => {
                 drawCanvasImage(ctxBg, img);
             };
             new_bck_inp.value = "";
             //update a background link for the view in local storage
             root.background = img.src;
             await chrome.storage.local.set({[root.id]: root});
             console.log("updated background of view id " + root.id);
             //save to backgrounds TODO
         }
     })*/
    await showBackgroundsClickListener(event,currentView);
}

async function showBookmarksClickListener(event) {
    document.removeEventListener('keyup', keyUpListener);
    hideCtxMenu()
    const tree = await chrome.bookmarks.getTree();
    const result = await chrome.storage.local.get("bookmarks")
    const faviconChrome = /^true$/i.test(result.bookmarks.faviconChrome);
    await createBookmarksDialogBox(event, tree,faviconChrome);
}

function handleLinkClickReadingList(event, link) {
    event.preventDefault();
    chrome.tabs.query({}, async function (tabs) {
        const matchingTab = tabs.find(tab => tab.url === link);
        if (matchingTab) {
            chrome.tabs.highlight({tabs: matchingTab.index}, function () {
                console.log("opening tab with link "+matchingTab.url);
            })
            return false;
        } else {
            await chrome.tabs.create({url: link});
        }
    });
}

function populateReadingListDialogBox(items, popup_content,faviconChrome) {
    for (const item of items) {
        //adding links
        const link = item.url;
        const newLink = document.createElement("a");
        const newImg = document.createElement("img");
        newImg.src = faviconChrome?faviconURLChrome(item.url):faviconURL(item.url);
        newImg.onerror = () => {
            newImg.src = faviconURLChrome(item.url);
        }
        newImg.width = 32;
        newImg.height = 32;
        newImg.loading = "lazy";
        newImg.alt = link;
        newLink.href = link;
        newLink.title = item.title;
        newLink.target = "_blank";
        newLink.id = "reading_list," + item.id;
        newLink.link = item.url;
        newLink.appendChild(newImg);
        newLink.addEventListener("click", function (event) {
            handleLinkClickReadingList(event, link);
        }, false);
        newImg.addEventListener('dragstart', function (dragEvent) {
            dragStart(dragEvent)
        }, false);
        newImg.addEventListener("dragend", function (dragEvent) {
            dragEnd(dragEvent)
        }, false);
        newLink.addEventListener("contextmenu", function (event) {
            handleReadingListLinkCtM(event, newLink);
        }, false);
        popup_content.appendChild(newLink);

    }
}


async function showReadingListClickListener(event) {
    hideCtxMenu()
    const items = await chrome.readingList.query({});
    //create popup with bookmarks urls
    const result = await chrome.storage.local.get("readingList");
    const faviconChrome = /^true$/i.test(result["readingList"].faviconChrome);
    createReadingListDialogBox(event, items,faviconChrome);
}

function copyUrlClickListener(link) {
    hideCtxMenu()
    //get item id from storage
    navigator.clipboard.writeText(link.url).then(() => {
    });
}
async function removeReadingLinkClickListener(newLink) {
    if (confirm("Are you sure Moving the Link To The Trash")) {
        const itemId = newLink.id.replace("reading_list,", "");
        document.getElementById("reading-list,popup-content").removeChild(document.getElementById(newLink.id));
        hideCtxMenu()
        //remove item from reading_list
        await chrome.readingList.removeEntry({url: "" + newLink.link});
        console.log(itemId + " link was removed from The readingList");
        //move a link to trash
        const result = await chrome.storage.local.get("trash");
        const trash = result["trash"];
        const linkIndex = trash.links ? trash.links.length : 0;
        const id = linkIndex > 0 ? trash.links[trash.links.length - 1] + 1 : 0;
        trash.links[linkIndex] = linkIndex > 0 ? id : 0;
        await chrome.storage.local.set({[trash.id]: trash});
        console.log(trash.id + " items has been updated");
        //store link in local storage
        const linkId = trash.id + "," + id;
        const newLinkData = {
            id: linkId,
            link: newLink.link,
            title: newLink.title
        };
        await chrome.storage.local.set({[linkId]: newLinkData});
        console.log(linkId + " has been added");
        const popup_content = document.getElementById(trash.id + ",popup-content");
        if (popup_content) {
            await addLinkInDialog(id, popup_content, trash.id);
        }
    }
}

function populateOpenTabsDialogBox(tabs, popup_content,faviconChrome) {
    for (const tab of tabs) {
        //adding links
        const link = tab.url;
        if (!link.includes("chrome-extension://")) {
            const newLink = document.createElement("a");
            const newImg = document.createElement("img");
            newImg.src = faviconChrome ? faviconURLChrome(tab.url) : faviconURL(tab.url);
            newImg.onerror = () => {
                newImg.src = faviconURLChrome(tab.url);
            }
            newImg.alt = link;
            newImg.loading = "lazy";
            newImg.height = 32;
            newImg.width = 32;
            newLink.href = link;
            newLink.title = tab.title;
            newLink.target = "_blank";
            newLink.appendChild(newImg);
            newImg.addEventListener('dragstart', dragEvent => {
                dragStart(dragEvent)
            }, false);
            newImg.addEventListener("dragend", dragEvent => {
                dragEnd(dragEvent)
            }, false);
            newLink.addEventListener("contextmenu", function (event) {
                handleOpenTabsLinkCtMe(tab, event);
            }, false);
            newLink.addEventListener("click", function (event) {
                event.preventDefault();
                chrome.tabs.highlight({tabs: tab.index}, function () {
                    console.log("hide");
                })
            }, false);
            popup_content.appendChild(newLink);
        }
    }
}

function handleOpenTabsLinkCtMe(tab, event) {
    const ctxData = [
        {id: "cpyUrl", type: "click", fun: copyUrlClickListener, text: "Copy Url"}
    ]
    buildCtxMenu(ctxData, tab, event);
}

async function showTabsClickListener(event) {
    hideCtxMenu()
    const tabs = await chrome.tabs.query({});
    //create popup with open tabs urls
    createOpenTabsDialogBox(event, tabs);
}

function buildCtxMenu(ctxData, newLink, event,additionalFunctionality) {
    hideCtxMenu();
    const contextMenuDiv = document.createElement("div");
    const contextMenuUl = document.createElement("ul");
    contextMenuDiv.appendChild(contextMenuUl);
    ctxData.forEach(ctxItem => {
        const menuItem = document.createElement("li");
        const menuItemLink = document.createElement("a");
        menuItemLink.href = '#';
        menuItemLink.innerHTML = ctxItem.text;
        menuItem.appendChild(menuItemLink);
        menuItem.id = ctxItem.id;
        menuItem.addEventListener(ctxItem.type, async function () {
            await ctxItem.fun(newLink);
        }, false);
        contextMenuUl.appendChild(menuItem);
    });
    if(additionalFunctionality){
        additionalFunctionality(contextMenuUl)
    }
    buildCtxMenuDiv(contextMenuDiv, event);
}

async function populatingLinksInDialog(item, popup_content,faviconChrome) {
    if (item.links) {
        for (const linkIndex of item.links) {
            await addLinkInDialog(linkIndex, popup_content, item.id,faviconChrome);
        }
    }
}

async function addNewGifListener(newUrlTitleInput, popup_content,linkId) {
    const newLinkInp = document.getElementById("new-link-inp");
    if (newLinkInp.value !== "") {
        const url = newLinkInp.value;
        const urlTitle = newUrlTitleInput.value || newLinkInp.value;
        const result = await chrome.storage.local.get("gifs");
        await addLinkToGifsItem(result["gifs"], url, urlTitle, popup_content,linkId);
        newLinkInp.value = "";
    }
}

async function changeIconClickListener(linkId, itemChangeTitleInput) {
    document.removeEventListener('keyup', keyUpListener);
    const itemDom = document.getElementById(linkId).firstChild;
    if (itemChangeTitleInput.value !== "") {
        //update dom element with the new image
        itemDom.src = itemChangeTitleInput.value;
        itemDom.height = 32;
        itemDom.width = 32;
        //update storage
        const result = await chrome.storage.local.get(linkId);
        const item = result[linkId];
        item.link = itemChangeTitleInput.value;
        await chrome.storage.local.set({[linkId]: item});
        console.log(linkId + " updated with new image " + item.src);
    }
}
//TODO extract common code
async function addLinkInDialog(linkIndex, popup_content, itemId, faviconChrome) {
    //retrieve from storage
    const linkId = itemId + "," + linkIndex;
    const result = await chrome.storage.local.get(linkId);
    const linkItem = result[linkId];
    const link = linkItem.link;
    const newLink = document.createElement("a");
    const newImg = document.createElement("img");
    if (linkItem.icon === linkItem.link) {
        if (isValidImageURL(link)) {
            newImg.src = link;
            newImg.onerror = () => {
                newImg.src = "images/default-link.webp";
            };
        } else {
            const result = await chrome.storage.local.get(linkId);
            const linkFaviconChrome = /^true$/i.test(result[linkId].faviconChrome);
            newImg.src = faviconChrome||linkFaviconChrome?faviconURLChrome(link):faviconURL(link);
        }
    }
    else {
        newImg.src = linkItem.icon;
    }
    newImg.height = 32;
    newImg.width = 32;
    newImg.alt = link;
    newImg.loading = "lazy";
    newImg.id = linkId+",img";
    newImg.onerror = () => {
        newImg.src = "images/default-link.webp";
    };
    newLink.href = link;
    newLink.title = linkItem.title ? linkItem.title : link;
    newLink.target = "_blank";
    newLink.id = linkId;
    newLink.appendChild(newImg);
    newLink.addEventListener("click", openTabListener(link));
    newLink.addEventListener("contextmenu", async function (event) {
        await handlePopupLinkCtMe(linkId, event);
    });
    popup_content.appendChild(newLink);
}


async function showGifsClickListener(event) {
    hideCtxMenu()
    document.removeEventListener('keyup', keyUpListener);
    const result = await chrome.storage.local.get("gifs");
    //create popup with GIFs urls
    const gifLinks = result["gifs"].links;
    await createGifsDialogBox(event, result, gifLinks);
}
//TODO dup
function createGifsDialogBox(event, result, gifLinks) {
    createDialogBox(event, "Gifs", "gifs", (dialog, dialog_content) => {
        populateGifsDialogBox(gifLinks, result, dialog_content);
        const addNewLinkBtn = document.createElement("button");
        const newUrlTitleInput = document.createElement("input");
        const newUrlInput = document.createElement("input");
        const newUrlTitleLabel = document.createElement("label");
        addNewLinkBtn.id = "add-new-link-btn";
        addNewLinkBtn.innerHTML = "Add New Link";
        newUrlTitleInput.type = "text";
        newUrlTitleLabel.innerHTML = "Url Title";
        newUrlInput.id = "new-link-inp";
        newUrlInput.type = "text";
        newUrlInput.minLength = 8;
        newUrlInput.maxLength = 500;
        newUrlInput.size = 30;
        dialog.appendChild(addNewLinkBtn);
        dialog.appendChild(newUrlInput);
        dialog.appendChild(newUrlTitleLabel);
        dialog.appendChild(newUrlTitleInput);
        newUrlInput.focus();
        addNewLinkBtn.addEventListener("click", function () {
            addNewGifListener(newUrlTitleInput, dialog_content)
        }, false);
    });
}
//TODO Too Long and dup from changeObjectIconClickListener
async function changeIconLinkClickListener(linkId) {
    hideCtxMenu()
    document.removeEventListener('keyup', keyUpListener);
    const result = await chrome.storage.local.get("gifs");
    //create a dialog with GIFs urls
    const gifLinks = result["gifs"].links;
    const dialog = document.createElement("div");
    const dialog_title = document.createElement("div");
    dialog_title.innerHTML = "Gifs";
    dialog_title.style.textAlign = "center";
    dialog_title.style.padding = "5px";
    dialog_title.style.cursor = "move";
    dialog_title.style.color = "gainsboro";
    dialog_title.className = "prevent-select";
    dialog_title.addEventListener('mousedown', (event) => {
        dialog.classList.add('is-dragging')
        let l = dialog.offsetLeft
        let t = dialog.offsetTop
        let startX = event.pageX
        let startY = event.pageY
        const drag = (event) => {
            dialog.style.left = l + (event.pageX - startX) + 'px'
            dialog.style.top = t + (event.pageY - startY) + 'px'
        }
        const mouseup = () => {
            dialog.classList.remove('is-dragging')
            document.removeEventListener('mousemove', drag)
            document.removeEventListener('mouseup', mouseup)
        }
        document.addEventListener('mousemove', drag)
        document.addEventListener('mouseup', mouseup)

    })
    dialog.appendChild(dialog_title);
    const resetBtn = document.createElement("button");
    resetBtn.id = "reset-btn";
    resetBtn.innerHTML = "Reset";
    const addNewLinkBtn = document.createElement("button");
    addNewLinkBtn.id = "add-new-link-btn";
    addNewLinkBtn.innerHTML = "Add New Link";
    const newUrlTitleInput = document.createElement("input");
    newUrlTitleInput.type = "text";
    const newUrlTitleLabel = document.createElement("label");
    newUrlTitleLabel.innerHTML = "Url Title";
    const newUrlInput = document.createElement("input");
    newUrlInput.id = "new-link-inp";
    newUrlInput.type = "text";
    newUrlInput.minLength = 8;
    newUrlInput.maxLength = 500;
    newUrlInput.size = 30;
    dialog.id = "gifs-popup";
    dialog.className = "popup";
    const popup_content = document.createElement("div");
    popup_content.id = "gifs,popup-content";
    popup_content.className = "popup-content";
    dialog.appendChild(addNewLinkBtn);
    dialog.appendChild(newUrlInput);
    dialog.appendChild(newUrlTitleLabel);
    dialog.appendChild(newUrlTitleInput);
    dialog.appendChild(resetBtn);
    dialog.appendChild(popup_content);
    document.body.appendChild(dialog);
    addNewLinkBtn.addEventListener("click", function () {
        addNewGifListener(newUrlTitleInput, popup_content, linkId)
    }, false);
    resetBtn.addEventListener("click", async function () {
        await resetGifListener(linkId)
    }, false);
    for (const linkIndex of gifLinks) {
        const gifsLinkId = result["gifs"].id + "," + linkIndex;
        const gifLinkItemResult = await chrome.storage.local.get(gifsLinkId);
        const linkItem = gifLinkItemResult[gifsLinkId];
        const link = linkItem.link;
        const newLink = document.createElement("a");
        const newImg = document.createElement("img");
        newImg.src = link;
        newImg.onerror = () => {
            newImg.src = "images/default-link.webp";
        };
        newImg.alt = link;
        newImg.width = 32;
        newImg.height = 32;
        newLink.href = link;
        newLink.title = linkItem.title ? linkItem.title : link;
        newLink.target = "_blank";
        newLink.id = gifsLinkId;
        newLink.appendChild(newImg);
        newLink.addEventListener("click", async function (event) {
            event.preventDefault();
            const itemDom = document.getElementById(linkId).firstChild;
            //update dom element with the new image
            itemDom.src = event.target.src;
            //update storage
            const result = await chrome.storage.local.get(linkId);
            const item = result[linkId];
            item.icon = event.target.src;
            await chrome.storage.local.set({[linkId]: item});
            //hide gifs_popup
            const gifs_popup = document.getElementById('gifs-dialog');
            const overlay = document.getElementById('overlay');
            overlay.style.display = 'none';
            if (gifs_popup) {
                document.body.removeChild(gifs_popup);
            }
            console.log(linkId + " updated with new image " + item.src);
        }, false);
        newLink.addEventListener("contextmenu", function (event) {
            handlePopupLinkCtMe(gifsLinkId, event);
        }, false);
        popup_content.appendChild(newLink);
    }
    document.getElementById('overlay').style.display = 'block';
    newUrlInput.focus();
}

//TODO
function recreateChBgDialog(currentTargetId) {
    document.removeEventListener('keyup', keyUpListener);
    const popup = document.createElement("div");
    const popup_title = document.createElement("div");
    popup_title.innerHTML = "Backgrounds";
    popup_title.style.textAlign = "center";
    popup_title.style.padding = "5px";
    popup_title.style.cursor = "move";
    popup_title.style.color = "gainsboro";
    popup_title.className = "prevent-select";
    popup_title.addEventListener('mousedown', (event) => {
        popup.classList.add('is-dragging')
        let l = popup.offsetLeft
        let t = popup.offsetTop
        let startX = event.pageX
        let startY = event.pageY
        const drag = (event) => {
            popup.style.left = l + (event.pageX - startX) + 'px'
            popup.style.top = t + (event.pageY - startY) + 'px'
        }
        const mouseup = () => {
            popup.classList.remove('is-dragging')
            document.removeEventListener('mousemove', drag)
            document.removeEventListener('mouseup', mouseup)
        }
        document.addEventListener('mousemove', drag)
        document.addEventListener('mouseup', mouseup)

    })
    popup.appendChild(popup_title);
    document.getElementById('overlay').style.display = 'block';
    const saveBtn = document.createElement("button");
    saveBtn.id = "save-btn";
    const label = document.createElement("label");
    saveBtn.innerHTML = currentTargetId === "chgBck" ? "Save background" : "Save Icon";
    label.innerHTML = currentTargetId === "chgIc" ? "Background Picture Link" : "Icon Link";
    label.htmlFor = "new-bck-inp";
    const newBckInput = document.createElement("input");
    newBckInput.id = "new-bck-inp";
    newBckInput.type = "text";
    newBckInput.minLength = 8;
    newBckInput.maxLength = 500;
    newBckInput.size = 30;
    popup.appendChild(saveBtn);
    popup.appendChild(label);
    popup.appendChild(newBckInput);
    document.body.appendChild(popup);
    newBckInput.focus();
    return saveBtn;
}
function handleReadingListLinkCtM(event, newLink) {
    const ctxData = [
        {id:"cpyUrl",type:"click",fun:copyUrlClickListener,text:"Copy Url"},
        {id:"remLi",type:"click",fun:removeReadingLinkClickListener,text:"Remove Link"}
    ]
    buildCtxMenu(ctxData, newLink, event);
}
async function handlePopupLinkCtMe(linkId, event) {
    const ctxData = [
        { id: "remLi", type: "click", fun: removeLinkClickListener, text: "Remove Link" },
        { id: "chgIc", type: "click", fun: changeIconLinkClickListener, text: "Change Icon" }
    ];
    buildCtxMenu(ctxData, linkId, event, async function (contextMenuDiv) {
        const result = await chrome.storage.local.get(linkId);
        const faviconChrome = /^true$/i.test(result[linkId].faviconChrome);
        const switchToggle = createToggleSwitch(linkId, faviconChrome, async (newFaviconChrome) => {
            const result = await chrome.storage.local.get(linkId);
            const item = result[linkId];
            item.faviconChrome = newFaviconChrome;
            await chrome.storage.local.set({[linkId]: item});
            console.log(linkId + " updated with new faviconChrome " + item.faviconChrome);
            const linkImg = document.getElementById(linkId + ",img");
            linkImg.src = newFaviconChrome?faviconURLChrome(item.link):faviconURL(item.link);
        });
        const menuItem = document.createElement("li");
        menuItem.appendChild(switchToggle);
        contextMenuDiv.appendChild(menuItem);
    });
}
async function updateItemIconStorage(itemId, event) {
    const result = await chrome.storage.local.get(itemId);
    const item = result[itemId];
    item.icon = event.target.src;
    await chrome.storage.local.set({[itemId]: item});
    console.log(itemId + " updated with new image " + item.src);
}

async function addLinkInGifsPopup(linkIndex, popup_content, itemId, clickableItemId) {
    //retrieve from storage
    const linkId = itemId + "," + linkIndex;
    const result = await chrome.storage.local.get(linkId);
    const linkItem = result[linkId];
    const link = linkItem.link;
    const newLink = document.createElement("a");
    const newImg = document.createElement("img");
    newImg.src = link;
    newImg.onerror = () => {
        newImg.src = "images/default-link.webp";
    };
    newImg.height = 32;
    newImg.width = 32;
    newImg.id = linkId + ",img";
    newImg.alt = link;
    newLink.href = link;
    newLink.title = linkItem.title ? linkItem.title : link;
    newLink.target = "_blank";
    newLink.id = linkId;
    newLink.appendChild(newImg);
    if (clickableItemId) {
        newLink.addEventListener("click", async function (event) {
            event.preventDefault();
            const itemDom = document.getElementById(clickableItemId + ",img");
            //update dom element with the new image
            itemDom.src = event.target.src;
            itemDom.height = 32;
            itemDom.width = 32;
            //update storage
            const result = await chrome.storage.local.get(clickableItemId);
            const item = result[clickableItemId];
            item.icon = event.target.src;
            await chrome.storage.local.set({[clickableItemId]: item});
            console.log(clickableItemId + " updated with new image " + item.icon);
        }, false);
    }

    newLink.addEventListener("contextmenu", function (event) {
        handleGifsLinkCtMe(linkId, event);
    }, false);
    popup_content.appendChild(newLink);
}

function handleGifsLinkCtMe(linkId,event) {
    const ctxData = [
        {id: "remLi", type: "click", fun: removeLinkClickListener, text: "Remove Link"}
    ]
    buildCtxMenu(ctxData, linkId, event);
}

async function resetGifListener(linkId) {
    const itemDom = document.getElementById(linkId).firstChild;
    //update dom element with the new image
    itemDom.src = faviconURL(itemDom.alt);
    itemDom.height = 32;
    itemDom.width = 32;
    //update storage
    const result = await chrome.storage.local.get(linkId);
    const item = result[linkId];
    item.link = itemDom.alt;
    item.icon = itemDom.alt;
    await chrome.storage.local.set({[linkId]: item});
    console.log(linkId + " icon was with reset");
}
//TODO dup
async function changeObjectClickListener(object, event) {
    const itemId = object.id;
    hideCtxMenu()
    document.removeEventListener('keyup', keyUpListener);
    const result = await chrome.storage.local.get("gifs");
    //create popup with GIFs urls
    const gifLinks = result["gifs"].links;
    const popup = document.createElement("div");
    const popup_title = document.createElement("div");
    popup_title.innerHTML = "Gifs";
    popup_title.style.textAlign = "center";
    popup_title.style.padding = "5px";
    popup_title.style.cursor = "move";
    popup_title.style.color = "gainsboro";
    popup_title.className = "prevent-select";
    popup_title.addEventListener('mousedown', (event) => {
        popup.classList.add('is-dragging')
        let l = popup.offsetLeft
        let t = popup.offsetTop
        let startX = event.pageX
        let startY = event.pageY
        const drag = (event) => {
            popup.style.left = l + (event.pageX - startX) + 'px'
            popup.style.top = t + (event.pageY - startY) + 'px'
        }
        const mouseup = () => {
            popup.classList.remove('is-dragging')
            document.removeEventListener('mousemove', drag)
            document.removeEventListener('mouseup', mouseup)
        }
        document.addEventListener('mousemove', drag)
        document.addEventListener('mouseup', mouseup)

    })
    popup.appendChild(popup_title);
    const resetBtn = document.createElement("button");
    resetBtn.id = "reset-btn";
    resetBtn.innerHTML = "Reset";
    const addNewLinkBtn = document.createElement("button");
    addNewLinkBtn.id = "add-new-link-btn";
    addNewLinkBtn.innerHTML = "Add New Link";
    const newUrlTitleInput = document.createElement("input");
    newUrlTitleInput.type = "text";
    const newUrlTitleLabel = document.createElement("label");
    newUrlTitleLabel.innerHTML = "Url Title";
    const newUrlInput = document.createElement("input");
    newUrlInput.id = "new-link-inp";
    newUrlInput.type = "text";
    newUrlInput.minLength = 8;
    newUrlInput.maxLength = 500;
    newUrlInput.size = 30;
    popup.id = "gifs-popup";
    popup.className = "popup";
    popup.style.left = (event.pageX - 10) + "px";
    popup.style.top = (event.pageY - 10) + "px";
    const popup_content = document.createElement("div");
    popup_content.id = "gifs,popup-content";
    popup_content.className = "popup-content";
    popup.appendChild(addNewLinkBtn);
    popup.appendChild(newUrlInput);
    popup.appendChild(newUrlTitleLabel);
    popup.appendChild(newUrlTitleInput);
    popup.appendChild(resetBtn);
    popup.appendChild(popup_content);
    document.body.appendChild(popup);
    addNewLinkBtn.addEventListener("click", function () {
        const newLinkInp = document.getElementById("new-link-inp");
        if (newLinkInp.value !== "") {
            const url = newLinkInp.value;
            const urlTitle = newUrlTitleInput.value || newLinkInp.value;
            //add the link to item local storage
            addLinkToGifsItem(result["gifs"], url, urlTitle, popup_content, itemId);
            newLinkInp.value = "";
        }
    }, false);
    resetBtn.addEventListener("click", async function () {
        await resetGifListener(itemId);
    }, false);
    for (const linkIndex of gifLinks) {
        const gifsLinkId = result["gifs"].id + "," + linkIndex;
        const gifLinkResult = await chrome.storage.local.get(gifsLinkId);
        const linkItem = gifLinkResult[gifsLinkId];
        if (linkItem) {
            const link = linkItem.link;
            const newLink = document.createElement("a");
            const newImg = document.createElement("img");
            newImg.src = link;
            newImg.onerror = () => {
                newImg.src = "images/default-link.webp";
            };
            newImg.alt = link;
            newImg.width = 32;
            newImg.height = 32;
            newLink.href = link;
            newLink.title = linkItem.title ? linkItem.title : link;
            newLink.target = "_blank";
            newLink.id = gifsLinkId;
            newLink.appendChild(newImg);
            newLink.addEventListener("click", async function (event) {
                event.preventDefault();
                const itemDom = document.getElementById(object.id + ",img");
                //update dom element with the new image
                itemDom.src = event.target.src;
                itemDom.height = 32;
                itemDom.width = 32;
                //hide gifs_popup
                const gifs_popup = document.getElementById('gifs-popup');
                const overlay = document.getElementById('overlay');
                overlay.style.display = 'none';
                if (gifs_popup) {
                    document.body.removeChild(gifs_popup);
                }
                //update storage
                await updateItemIconStorage(itemId, event);
            }, false);
            newLink.addEventListener("contextmenu", function (event) {
                handleLinkCtMe(gifsLinkId, event);
            }, false);
            popup_content.appendChild(newLink);
        }
    }
    document.getElementById('overlay').style.display = 'block';
    newUrlInput.focus();
}


async function removeObjectClickListener(object) {
    if (confirm("Are you sure to remove?")) {
        switch (object.type) {
            case "item":
                await removeItClickListener(object);
                break;
            case "station":
                await removeStClickListener(object);
                break;
            case "dummy":
                await removeDuClickListener(object);
                break;
        }
    }
}

async function changeObjectTitleClickListener(titleInput, object) {
    if (titleInput.value !== "") {
        document.getElementById(object.id + ",title").innerHTML = titleInput.value;
        object.title = titleInput.value;
        await chrome.storage.local.set({[object.id]: object});
        console.log(object.id + " title changed to " + titleInput.value);
    }
}

async function handleContextMenu(object, event, type) {
    hideCtxMenu();
    document.removeEventListener('keyup', keyUpListener);
    const contextMenuDiv = document.createElement("div");
    const contextMenuUl = document.createElement("ul");
    contextMenuUl.appendChild(createMenuItem("chgObjIc", `Change ${type} Icon`, async function (event) {
        await changeObjectClickListener(object, event);
    }));
    contextMenuUl.appendChild(createMenuItem(`rem${type.charAt(0).toUpperCase() + type.slice(1)}`, `Remove ${type.charAt(0).toUpperCase() + type.slice(1)}`, async function () {
        await removeObjectClickListener(object);
    }));
    contextMenuUl.appendChild(createTitleInputMenuItem(object));
    if (type==="Item"){
        const result = await chrome.storage.local.get(object.id)
        const faviconChrome = /^true$/i.test(result[object.id].faviconChrome);
        const switchToggle = createToggleSwitch(object.id, faviconChrome, async (newFaviconChrome) => {
            const popup_content = document.getElementById(object.id + ",popup-content");
            popup_content.innerHTML = "";
            await populatingLinksInDialog(object, popup_content, newFaviconChrome);
        });
        const menuItem = document.createElement("li");
        menuItem.appendChild(switchToggle);
        contextMenuUl.appendChild(menuItem);
    }
    contextMenuDiv.appendChild(contextMenuUl);
    buildCtxMenuDiv(contextMenuDiv, event);
    imageToChange = "background";
}

function handleItemCtMe(object, event) {
    handleContextMenu(object, event, "Item");
}

function handleStationCtMe(object, event) {
    handleContextMenu(object, event, "Station");
}

function handleDummyCtMe(object, event) {
    handleContextMenu(object, event, "Dummy");
}
function createMenuItem(id, text, clickHandler) {
    const menuItem = document.createElement("li");
    const menuItemLink = document.createElement("a");
    menuItemLink.href = '#';
    menuItemLink.innerHTML = text;
    menuItem.appendChild(menuItemLink);
    menuItem.id = id;
    menuItem.addEventListener('click', async function (event) {
        await clickHandler(event);
    }, false);
    return menuItem;
}

function createTitleInputMenuItem(object) {
    const menuItem = document.createElement("li");
    const itemTitleInput = document.createElement("input");
    const itemChangeIconBtn = document.createElement("button");
    itemChangeIconBtn.innerHTML = "Save";
    itemChangeIconBtn.id = "chgIcBtn";
    itemTitleInput.style.width = "80px";
    itemTitleInput.value = object.title;
    itemTitleInput.addEventListener('click', async function (event) {
        event.stopPropagation();
    }, false);
    menuItem.appendChild(itemTitleInput);
    menuItem.appendChild(itemChangeIconBtn);
    itemChangeIconBtn.addEventListener('click', async function (event) {
        await changeObjectTitleClickListener(itemTitleInput, object);
    }, false);
    return menuItem;
}

function createTitleInputMenuItemWithInput(btnId,inputId,text,rootId,fun) {
    const menuItem = document.createElement("li");
    const itemTitleInput = document.createElement("input");
    const itemChangeIconBtn = document.createElement("button");
    itemChangeIconBtn.innerHTML = "Add";
    itemChangeIconBtn.id = btnId;
    itemTitleInput.style.width = "80px";
    itemTitleInput.value = text;
    itemTitleInput.id = inputId;
    itemTitleInput.addEventListener('click', async function (event) {
        event.stopPropagation();
    }, false);
    menuItem.appendChild(itemTitleInput);
    menuItem.appendChild(itemChangeIconBtn);
    itemChangeIconBtn.addEventListener('click', async function (event) {
        await fun(rootId, event, itemTitleInput);
    }, false);
    return menuItem;
}

function changItBckClickListener(item, event) {
    //create popup with input for the background and change button
    const saveBtn = recreateChBgDialog(event.currentTarget.id);
    saveBtn.addEventListener("click", async function () {
        const new_bck_inp = document.getElementById("new-bck-inp");
        if (new_bck_inp.value !== "") {
            item.icon = new_bck_inp.value;
            const iconImg = document.getElementById(item.id + ',img');
            iconImg.src = item.icon;
            iconImg.alt = item.icon;
            //update item in storage
            await chrome.storage.local.set({[item.id]: item});
            console.log("updated icon of item id " + item.id);
            //save to gifs TODO
            new_bck_inp.value = "";
        }
    })
}
async function removeItClickListener(item) {
    hideCtxMenu()
    document.getElementById("panes").removeChild(document.getElementById(item.id));
    //get parent id
    const rootId = item.id.split(",")[0];
    const root = await chrome.storage.local.get("" + rootId).then(result => result["" + rootId]);
    const index = root.items.indexOf(parseInt(item.id.split(",")[1]));
    //remove from parent
    root.items.splice(index, 1);
    await chrome.storage.local.set({[rootId]: root});
    console.log(rootId + " is updated");
    //move links from item to trash
    if (item.links) {
        for (const linkIndex of item.links) {
            const linkId = item.id + "," + linkIndex;
            await removeLinksFromStorage(item.id, linkId);
        }
    }
    //remove item from local storage
    await chrome.storage.local.remove("" + item.id);
    console.log(item.id + " Item was removed from storage");
}

async function removeDuClickListener(dummy) {
    hideCtxMenu()
    document.getElementById("panes").removeChild(document.getElementById(dummy.id));
    //get parent id
    const rootId = dummy.id.split(",")[0];
    const root = await chrome.storage.local.get("" + rootId).then(result => result["" + rootId]);
    const index = root.items.indexOf(parseInt(dummy.id.split(",")[1]));
    //remove from parent
    root.dummies.splice(index, 1);
    await chrome.storage.local.set({[rootId]: root});
    //remove dummy from local storage
    await chrome.storage.local.remove("" + dummy.id);
    console.log(dummy.id + " Dummy was removed from storage");
}

async function removeStClickListener(station) {
    //Retrieve station.target from storage
    const view = await chrome.storage.local.get("" + station.target).then(result => result["" + station.target]);
    if (view.items.length > 0 || view.stations.length > 0 || view.dummies.lenght > 0) {
        alert("Station is not empty");
    }
    else{
        document.getElementById("panes").removeChild(document.getElementById(station.id));
        hideCtxMenu()
        //get parent id
        const rootId = station.id.split(",")[0];
        const root = await chrome.storage.local.get("" + rootId).then(result => result["" + rootId]);
        const indexToRemove = root.stations.indexOf(parseInt(station.id.split(",")[1]));
        //remove from parent
        root.stations.splice(indexToRemove, 1);
        await chrome.storage.local.set({[rootId]: root});
        console.log(rootId + " is updated");
        await chrome.storage.local.remove("" + station.id);
        console.log(station.id + " Item was removed from storage");
        const lastStationElement = await chrome.storage.local.get("lastStationViewId").then(result => result["lastStationViewId"]);
        const indexToRemoveLastStation = lastStationElement.target.indexOf(station.id);
        //remove from parent
        lastStationElement.target.splice(indexToRemoveLastStation, 1);
        await chrome.storage.local.set({["lastStationViewId"]: lastStationElement});
        console.log(station.id + " was removed from lastStationViewId");
    }
}
//TODO dup
async function addLinkToItem(item, url, urlTitle, popup_content) {
    const linkIndex = item.links ? item.links.length : 0;
    const id = linkIndex > 0 ? item.links[item.links.length - 1] + 1 : 0;
    item.links[linkIndex] = linkIndex > 0 ? id : 0;
    await chrome.storage.local.set({[item.id]: item});
    console.log(item.id + " items has been updated");
    //store link in local storage
    const linkId = item.id + "," + id;
    const newLinkData = {};
    newLinkData["id"] = linkId;
    newLinkData["link"] = url;
    newLinkData["icon"] = url;
    newLinkData["title"] = urlTitle;
    newLinkData["view"] = item.view;
    newLinkData["faviconChrome"] = "false";
    await chrome.storage.local.set({[linkId]: newLinkData});
    console.log(linkId + " has been added");
    await addLinkInDialog(id, popup_content, item.id);
}
//TODO dup
async function addLinkToGifsItem(item, url, urlTitle, popup_content, clickableItemId) {
    const linkIndex = item.links ? item.links.length : 0;
    const id = linkIndex > 0 ? item.links[item.links.length - 1] + 1 : 0;
    item.links[linkIndex] = linkIndex > 0 ? id : 0;
    await chrome.storage.local.set({[item.id]: item});
    console.log(item.id + " items has been updated");
    //store link in local storage
    const linkId = item.id + "," + id;
    const newLinkData = {
        id: linkId,
        link: url,
        title: urlTitle,
        view: item.view
    };
    await chrome.storage.local.set({[linkId]: newLinkData});
    console.log(linkId + " has been added");
    await addLinkInGifsPopup(id, popup_content, item.id, clickableItemId);
}

async function resetAndLoadView(station) {
    //reset current view
    document.getElementById('panes').innerHTML = "";
    document.getElementById('back-btn-div').innerHTML = "";
    //load new view
    const view = await chrome.storage.local.get("" + station.target);
    await init(view["" + station.target]);
}

function zIndexFlicker(newZIndex, newPane) {
    newZIndex.innerHTML = newPane.style["zIndex"];
    newZIndex.classList.remove('show');
    // this force-restarts the CSS animation
    void newZIndex.offsetWidth;
    newZIndex.classList.add('show');
}

function handleObjectContextMenu(object, event) {
    switch (object.type) {
        case "item":
            handleItemCtMe(object, event);
            break;
        case "station":
            handleStationCtMe(object, event);
            break;
        case "dummy":
            handleDummyCtMe(object, event);
            break;
        default:
            console.log("Error Menu");
    }
}

function createDialogBox(event, title, contentId, additionalCallback) {
    const dialog = document.createElement("div");
    const dialog_title = document.createElement("div");
    const dialog_content = document.createElement("div");
    dialog_title.innerHTML = title;
    dialog_title.style.textAlign = "center";
    dialog_title.style.padding = "5px";
    dialog_title.style.cursor = "move";
    dialog_title.style.color = "gainsboro";
    dialog_title.className = "prevent-select";
    dialog_title.addEventListener('mousedown', (event) => {
        dialog.classList.add('is-dragging');
        let l = dialog.offsetLeft;
        let t = dialog.offsetTop;
        let startX = event.pageX;
        let startY = event.pageY;
        const drag = (event) => {
            dialog.style.left = l + (event.pageX - startX) + 'px';
            dialog.style.top = t + (event.pageY - startY) + 'px';
        };
        const mouseup = () => {
            dialog.classList.remove('is-dragging');
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', mouseup);
        };
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', mouseup);
    });
    dialog.appendChild(dialog_title);
    dialog.id = contentId + "-popup";
    dialog.className = "popup";
    dialog_content.id = contentId + ",popup-content";
    dialog_content.className = "popup-content";
    additionalCallback(dialog,dialog_content);
    dialog.appendChild(dialog_content);
    document.body.appendChild(dialog);
    adjustDialogInWindow(dialog);
    showOverlay();
}
//TODO refactor to use createDialogBox function and remove popup creation logic from index.html
async function createItemDialogBox(object,faviconChrome) {
    createDialogBox(event, object.id, object.id, async (dialog, dialog_content) => {
        populatingLinksInDialog(object, dialog_content, faviconChrome);
        document.removeEventListener('keyup', keyUpListener);
        const addNewLinkBtn = document.createElement("button");
        const changeTitleBtn = document.createElement("button");
        const itemTitleInput = document.createElement("input");
        const newUrlInput = document.createElement("input");
        const newUrlTitleLabel = document.createElement("label");
        const newUrlTitleInput = document.createElement("input");
        addNewLinkBtn.id = "add-new-link-btn";
        addNewLinkBtn.innerHTML = "Add New Link";
        changeTitleBtn.id = "chg-title-btn";
        changeTitleBtn.innerHTML = "Change Item's Title";
        itemTitleInput.id = "ttl-inp";
        itemTitleInput.type = "text";
        itemTitleInput.minLength = 3;
        itemTitleInput.maxLength = 50;
        itemTitleInput.size = 20;
        itemTitleInput.value = object.title;
        newUrlInput.id = "link-inp";
        newUrlInput.type = "text";
        newUrlInput.minLength = 8;
        newUrlInput.maxLength = 500;
        newUrlInput.size = 30;
        newUrlTitleLabel.innerHTML = "Url Title";
        newUrlTitleInput.type = "text";
        const switchToggle = createToggleSwitch(object.id, faviconChrome, async (newFaviconChrome) => {
            const popup_content = document.getElementById(object.id + ",popup-content");
            dialog_content.innerHTML = "";
            popup_content.innerHTML = "";
            await populatingLinksInDialog(object, dialog_content, newFaviconChrome);
            await populatingLinksInDialog(object, popup_content, newFaviconChrome);
        });
        dialog.appendChild(addNewLinkBtn);
        dialog.appendChild(newUrlInput);
        dialog.appendChild(newUrlTitleLabel);
        dialog.appendChild(newUrlTitleInput);
        dialog.appendChild(changeTitleBtn);
        dialog.appendChild(itemTitleInput);
        dialog.appendChild(switchToggle);
        addNewLinkBtn.addEventListener("click", async function () {
            const newLinkInp = document.getElementById("link-inp");
            if (newLinkInp.value !== "") {
                const url = newLinkInp.value;
                const urlTitle = newUrlTitleInput.value || url;
                const popup_content = document.getElementById("popup-content");
                //add the link to item local storage
                await addLinkToItem(object, url, urlTitle, popup_content);
                newLinkInp.value = "";
            }
        }, false);
        changeTitleBtn.addEventListener("click", async function () {
            if (itemTitleInput.value !== "") {
                document.getElementById(object.id + ",title").innerHTML = itemTitleInput.value;
                object.title = itemTitleInput.value;
                await chrome.storage.local.set({[object.id]: object});
                console.log(object.id + " title changed to " + itemTitleInput.value);
            }
        }, false);
        newUrlInput.focus();
    })
}

async function createItemPopup(object, newContent, newPane) {
    const popup = document.createElement("div");
    popup.id = object.id + ",popup";
    popup.className = "popup hidden";
    popup.style.top = (parseInt(object.top.replace("px", "")) - 85) + "px";
    popup.style.left = object.left;
    const popup_content = document.createElement("div");
    popup_content.id = object.id + ",popup-content";
    popup_content.className = "popup-content";
    newContent.addEventListener("drop", async dragEvent => {
        await drop(dragEvent)
    })
    newContent.addEventListener("dragover", dragEvent => {
        allowDrop(dragEvent)
    })

    popup.appendChild(popup_content);
    //adding links
    const result = await chrome.storage.local.get(object.id);
    const faviconChrome = result[object.id] !== undefined ?
        /^true$/i.test(result[object.id].faviconChrome): /^true$/i.test(object.faviconChrome);
    await populatingLinksInDialog(object, popup_content,faviconChrome);
    newPane.appendChild(popup)
}

async function handlePaneMouseOverListener(event) {
    const offsetParent = event.target.offsetParent;
    //get item type id from storage.local
    const target = event.target ? event.target:event.relatedTarget;
    let itemId = target.id.replace(",img","").replace(",title","");
    //keep 5 characters from itemId
    if (itemId==="background"){
        itemId = offsetParent.id.replace(",corner","");
    }
    if (itemId === ""){
        itemId = event.target.offsetParent.id.replace(",corner","");
    }

    itemId = itemId.split(",").slice(0, 3).join(",");
    const result = await chrome.storage.local.get(itemId);
    if (result[itemId] !== undefined) {
        const type = result[itemId].type;
        if (type === "item") {
            const panePopup = document.getElementById(itemId + ",popup");
            const pane = document.getElementById(itemId);
            panePopup.className = "popup visible"
            panePopup.style.top = (parseInt(pane.style.top.replace("px", "")) - 85) + "px";
            panePopup.style.left = pane.style.left;
        }
        try {
            const corner = document.getElementById(itemId + ",corner");
            corner.className = "corner visible";
        } catch (error) {
            console.log("Error setting corner visibility:");
        }
    }
}

async function handlePaneMouseOutListener(event) {
    const offsetParent = event.target.offsetParent;
    const target = event.target ? event.target:event.relatedTarget;
    let itemId = target.id.replace(",img","").replace(",title","");
    if (itemId==="background"){
        itemId = offsetParent.id.replace(",corner","");
    }
    if (itemId === ""){
        itemId = event.target.offsetParent.id.replace(",corner","");
    }
    itemId = itemId.split(",").slice(0, 3).join(",");
    const result = await chrome.storage.local.get(itemId);
    if (result[itemId] !== undefined) {
        const type = result[itemId].type;
        if (type === "item") {
            const panePopup = document.getElementById(itemId + ",popup");
            try {
                panePopup.className = "popup hidden";
            } catch (e) {
                console.log("Error hiding pane popup");
            }
        }
        const corner = document.getElementById(itemId + ",corner");
        try {
            corner.className = "corner hidden";
        } catch (e) {
            console.log("Error hiding corner");
        }
    }
}

//TODO too big
async function populatePanes(object, panes) {
    let z = 1
    const newTitle = document.createElement("div");
    const newZIndex = document.createElement("div");
    newZIndex.id = object.id + ",z";
    newZIndex.className = "zIndexNumber";
    newZIndex.innerHTML = object.zIndex;
    newTitle.id = object.id + ",title";
    newTitle.className = "title";
    const newHeader = document.createElement("h6");
    newHeader.innerHTML = object.title;
    newTitle.innerHTML = object.title;
    const newPane = document.createElement("div");
    newPane.className = object.type === "dummy" ? "dummyPane" : "pane";
    newPane.style["left"] = object.left;
    newPane.style["top"] = object.top;
    newPane.style["height"] = object.height;
    newPane.style["width"] = object.width;
    newPane.style["zIndex"] = object.zIndex;
    newPane.id = object.id;
    const newCorner = document.createElement("div");
    const imageNewCorner = document.createElement("img");
    newCorner.appendChild(imageNewCorner);
    imageNewCorner.src = "images/resize-right.svg";
    imageNewCorner.height = 16;
    imageNewCorner.width = 16;
    imageNewCorner.draggable = false;
    newCorner.id = object.id + ",corner";
    newCorner.className = "corner hidden";
    const newImg = document.createElement("img");
    newImg.id = object.id + ",img";
    newImg.src = object.icon;
    newImg.onerror = () => {
        newImg.src = object.type === "station"
            ? "images/station.png"
            : object.type === "dummy"
                ? "images/dummy.png"
                : "images/folder.png";
    };
    newImg.alt = object.icon;
    const newContent = document.createElement("div");
    newContent.className = "content";
    newContent.addEventListener("contextmenu", function (event) {
        handleObjectContextMenu(object, event);
    });
    newContent.appendChild(newImg);
    newPane.appendChild(newTitle);
    newPane.appendChild(newZIndex);
    if (object.type === "item") {
        await createItemPopup(object, newContent, newPane);
    }
    else if (object.type === "station") {
        newPane.style.cursor = "zoom-in"
        newContent.addEventListener("drop", async dragEvent => {
            await drop(dragEvent)
        }, false)
        newContent.addEventListener("dragover", dragEvent => {
            allowDrop(dragEvent)
        }, false)
    }
    newPane.appendChild(newContent);
    newPane.appendChild(newCorner);
    newPane.addEventListener('dblclick', async () => {
        if (object.target) {
            await resetAndLoadView(object);
        } else if (object.type === "item") {
            const result = await chrome.storage.local.get(object.id)
            const faviconChrome = /^true$/i.test(result[object.id].faviconChrome);
            await createItemDialogBox(object,faviconChrome);
        }
    })
    newContent.addEventListener('click', async () => {
        if (object.target) {
            const black_screen = $('#black-screen');
            black_screen.show();
            black_screen.fadeOut();
            await resetAndLoadView(object);
        }
    })
    newContent.addEventListener('wheel', async (event) => {
        if (event.deltaY > 0) {
            newPane.style["zIndex"]++;
            zIndexFlicker(newZIndex, newPane);
        } else if (newPane.style["zIndex"] > 0) {
            newPane.style["zIndex"]--;
            zIndexFlicker(newZIndex, newPane);
        }
        //update local storage
        const result = await chrome.storage.local.get(newPane.id);
        result[newPane.id].zIndex = newPane.style["zIndex"];
        await chrome.storage.local.set({[newPane.id]: result[newPane.id]});
        console.log(newPane.id + " zIndex is updated");
        return false;
    })
    newPane.addEventListener('mousedown', () => {
        z = z + 1
        newPane.style.zIndex = z
    })
    newPane.addEventListener('mouseover', handlePaneMouseOverListener);
    newPane.addEventListener('mouseout', handlePaneMouseOutListener);
    newTitle.addEventListener('mousedown', (event) => {
        newPane.classList.add('is-dragging')
        let l = newPane.offsetLeft
        let t = newPane.offsetTop
        let startX = event.pageX
        let startY = event.pageY
        const drag = (event) => {
            newPane.style.left = l + (event.pageX - startX) + 'px'
            newPane.style.top = t + (event.pageY - startY) + 'px'
        }
        const mouseup = async () => {
            newPane.classList.remove('is-dragging')
            document.removeEventListener('mousemove', drag)
            document.removeEventListener('mouseup', mouseup)
            //store position
            const result = await chrome.storage.local.get(newPane.id);
            result[newPane.id].left = newPane.style.left;
            result[newPane.id].top = newPane.style.top;
            await chrome.storage.local.set({[newPane.id]: result[newPane.id]});
            console.log(newPane.id + " positions are updated");
        }
        document.addEventListener('mousemove', drag)
        document.addEventListener('mouseup', mouseup)

    })
    newCorner.addEventListener('mousedown', (event) => {
        let w = newPane.clientWidth
        let h = newPane.clientHeight
        let startX = event.pageX
        let startY = event.pageY
        const drag = (event) => {

            newPane.style.width = w + (event.pageX - startX) + 'px'
            newPane.style.height = h + (event.pageY - startY) + 'px'
        }
        const mouseup = async () => {
            document.removeEventListener('mousemove', drag)
            document.removeEventListener('mouseup', mouseup)
            //store position
            const result = await chrome.storage.local.get(newPane.id);
            result[newPane.id].height = newPane.style.height;
            result[newPane.id].width = newPane.style.width;
            await chrome.storage.local.set({[newPane.id]: result[newPane.id]});
            console.log(newPane.id + " size is updated");

        }
        document.addEventListener('mousemove', drag)
        document.addEventListener('mouseup', mouseup)
    })
    newCorner.addEventListener('mouseover,mouseout', (event) => {event.stopPropagation()})
    newTitle.addEventListener('mouseover,mouseout', (event) => {event.stopPropagation()})
    newContent.addEventListener('mouseover,mouseout', (event) => {event.stopPropagation()})
    newImg.addEventListener('mouseover,mouseout', (event) => {event.stopPropagation()})
    imageNewCorner.addEventListener('mouseover,mouseout', (event) => {event.stopPropagation()})
    panes.appendChild(newPane);
}

function hideCtxMenu() {
    const contextMenu = document.getElementById("contextMenu");
    if (contextMenu) {
        document.body.removeChild(contextMenu);
        if (document.getElementById("overlay").style.display !== "block") { // check if overlay is hidden
            document.addEventListener('keyup', keyUpListener);
        }
    }
}

function faviconURL(u) {
    if (u === undefined){
        return "images/default-link.webp"; // Default image if URL is undefined
    }
    if (u.endsWith('.pdf')) {
        return 'images/pdf.png';
    }
    if (u.includes('images/')) {
        return u; // If the URL is already an image URL, return it as is
    }
    let website= new URL(u);
    return  "https://www.faviconextractor.com/favicon/" + website.hostname + "?larger=true";
}

function faviconURLChrome(u) {
    if (u === undefined){
        return "images/default-link.webp"; // Default image if URL is undefined
    }
    if (u.endsWith('.pdf')) {
        return 'images/pdf.png';
    }
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", u);
    url.searchParams.set("size", "32");
    return url.toString();
}

function isValidImageURL(str) {
    if (typeof str !== 'string') return false;
    return !!str.match(/\w+\.(jpg|jpeg|gif|png|tiff|bmp|webp)$/gi);
}

function hideAndRemovePopups(event) {
    document.addEventListener('keyup', keyUpListener);
    const popups = document.querySelectorAll('.popup');

    const overlay = document.getElementById('overlay');
    if (event.target === overlay) {
        popups.forEach(popup => {
            if (!popup.classList.contains('hidden')) {
                popup.style.display = 'none';
                document.body.removeChild(popup);
            }
        });
        overlay.style.display = 'none';
        const searchInputDiv = document.getElementById("searchInputDiv");
        searchInputDiv.style.visibility = "hidden";
    }
}

window.onclick = function (event) {
    const contextMenu = document.getElementById("contextMenu");
    if (contextMenu && !contextMenu.contains(event.target)) {
        hideCtxMenu();
    }
}
/*window.addEventListener("keyup", function (event) {
    if (event.key === "Escape") {
        const contextMenu = document.getElementById("contextMenu");
        if (contextMenu && !contextMenu.contains(event.target)) {
            hideCtxMenu();
        }
        this.hideAndRemovePopups(event);
    }

});*/
