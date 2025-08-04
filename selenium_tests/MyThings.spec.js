const Chrome = require('selenium-webdriver/chrome');
const path = require('path');
const {By, Browser, Builder} = require("selenium-webdriver");
const assert = require('assert');

// Constants
const EXTENSION_URL = 'chrome-extension://fifanmghgnpjmkopnhnohejffglfcpci/index.html';
const DEFAULT_SLEEP = 1000;

// Helper functions

async function navigateToExtension(driver) {
    await driver.get(EXTENSION_URL);
    await driver.wait(async () => {
        const readyState = await driver.executeScript('return document.readyState');
        return readyState === 'complete';
    }, 10000, 'Extension did not fully load in time');
    return driver;
}

async function assertElementDisplayed(driver, id, shouldBeDisplayed = true) {
    const element = await driver.findElement(By.id(id));
    const isDisplayed = await element.isDisplayed();
    assert.strictEqual(isDisplayed, shouldBeDisplayed,
        `Element with id ${id} should be ${shouldBeDisplayed ? 'displayed' : 'hidden'}`);
    return element;
}

async function assertElementExists(driver, id) {
    const element = await driver.findElement(By.id(id));
    assert.ok(element, `Element with id ${id} should exist`);
    return element;
}

async function openContextMenu(driver, elementId) {
    const element = await driver.findElement(By.id(elementId));
    await driver.actions().contextClick(element).perform();
    await driver.sleep(DEFAULT_SLEEP);
    return element;
}

async function clickElement(driver, id) {
    const element = await driver.findElement(By.id(id));
    await element.click();
    return element;
}

async function getStorageData(driver) {
    return await driver.executeScript(() => {
        return new Promise((resolve) => {
            chrome.storage.local.get(null, (items) => {
                resolve(items);
            });
        });
    });
}


async function elementExists(driver, id) {
    try {
        await driver.findElement(By.id(id));
        return true;
    } catch (e) {
        return false;
    }
}
async function buildDriver() {
    const options = new Chrome.Options();
    const projectRoot = path.resolve(__dirname, '.', '..');
    return new Builder()
        .forBrowser(Browser.CHROME)
        .setChromeOptions(
            options
                .setChromeBinaryPath('C:/Users/User/Downloads/chrome-win64/chrome.exe')
                .addArguments("load-extension=" + projectRoot, "--start-maximized", "--disable-infobars")
                .excludeSwitches(['enable-automation'])
        )
        .build()
        .then(async driver => {
            await navigateToExtension(driver); // Wait until the extension is loaded
            return driver;
        });}
async function checkNoConsoleErrors(driver) {
    const logs = await driver.manage().logs().get('browser');
    const errors = logs.filter(log => log.level.value >= 1000 && !log.message.includes("Failed to load resource: "));
    console.log(errors);
    assert.strictEqual(errors.length, 0, 'There should be no errors in the console');
}

async function loadTestingDataToChromeStorage(driver) {
    await driver.executeScript(async () => {
        const response = await fetch('MyThings-testing.json');
        const data = await response.json();
        await new Promise(resolve => chrome.storage.local.set(data, resolve));
    });
    //refresh page
    await driver.navigate().refresh();
}

describe('Should be able to Test the Extension Functionalities', function () {
    it('Basic Chrome test', async function () {
        let driver = await buildDriver()
        await navigateToExtension(driver);
        await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);
        await driver.get('https://www.selenium.dev/selenium/web/blank.html');
        await driver.quit();
    });
    it('Add Extension', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        assert.strictEqual(await driver.getTitle(), 'My Things');
        await driver.quit();
    });
    it('Check Elements', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        assert.strictEqual(await driver.getTitle(), 'My Things');

        const idsToCheck = [
            'black-screen',
            'background',
            'searchInputDiv',
            'searchInput',
            'searchResults',
            'panes',
            'overlay',
            'back-btn-div'
        ];

        for (const id of idsToCheck) {
            await assertElementExists(driver, id);
        }

        await driver.quit();
    });
    it('Check Search results are hidden by default', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);

        await assertElementDisplayed(driver, 'searchInput', false);
        await assertElementDisplayed(driver, 'searchResults', false);

        await driver.quit();
    });
    it('Check Search results should be displayed when typing anywhere', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);

        await driver.findElement(By.tagName('body')).sendKeys('a');

        await assertElementDisplayed(driver, 'searchInput', true);
        await assertElementDisplayed(driver, 'searchResults', true);

        await driver.quit();
    });
    it('Search results should disappear when clicking on overlay', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await loadTestingDataToChromeStorage(driver);
        // Type to show search
        await driver.findElement(By.tagName('body')).sendKeys('a');

        // Verify search is displayed
        await assertElementDisplayed(driver, 'searchInput', true);
        await assertElementDisplayed(driver, 'searchResults', true);

        // Click overlay to hide the search
        const overlay = await driver.findElement(By.id('overlay'));
        await overlay.click();

        // Verify search is hidden
        await assertElementDisplayed(driver, 'searchInput', false);
        await assertElementDisplayed(driver, 'searchResults', false);

        await driver.quit();
    });
    it('Search results should appear after hiding dialogs or popups', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);

        // Open context menu from background
        const background = await driver.findElement(By.id('background'));
        await driver.actions().contextClick(background).perform();
        await driver.sleep(DEFAULT_SLEEP);

        // Check that context menu is displayed
        await assertElementDisplayed(driver, 'contextMenu', true);
        await background.click();

        // Type to show search
        await driver.findElement(By.tagName('body')).sendKeys('a');

        // Verify search is displayed
        await assertElementDisplayed(driver, 'searchInput', true);
        await assertElementDisplayed(driver, 'searchResults', true);

        // Click overlay to hide search
        const overlay = await driver.findElement(By.id('overlay'));
        await overlay.click();

        // Verify search is hidden
        await assertElementDisplayed(driver, 'searchInput', false);
        await assertElementDisplayed(driver, 'searchResults', false);

        await driver.quit();
    });
    it('Show Gifs popup from context menu', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);
        // Open context menu and click on Show Gifs
        const background = await driver.findElement(By.id('background'));
        await driver.actions().contextClick(background).perform();
        const showGifs = await driver.findElement(By.id('shGifs'));
        await showGifs.click();

        // Verify Gifs popup is displayed
        await assertElementDisplayed(driver, 'gifs-popup', true);

        await driver.quit();
    });
    it('Validate chrome.storage.local', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);

        // Get all items from chrome.storage.local
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });

        // Validate json structure for each stations, items and dummies
        const map = new Map(Object.entries(result));
        console.assert(map.size > 0, "Storage should not be empty");

        map.forEach((value, key) => {
            if (!isNaN(key)) {
                // Validate stations
                value.stations.forEach(station => {
                    let stationKey = key + "," + station + ",s";
                    assert(map.has(stationKey), "Station key not found: " + stationKey);
                });

                // Validate items
                value.items.forEach(item => {
                    let itemKey = key + "," + item + ",i";
                    assert(map.has(itemKey), "Item key not found: " + itemKey);
                });

                // Validate dummies
                value.dummies.forEach(dummy => {
                    let dummyKey = key + "," + dummy + ",d";
                    assert(map.has(dummyKey), "Dummy key not found: " + dummyKey);
                });
            }
        });

        await driver.quit();
    });
    it('When hovering over item a popup should appear', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);

        // Check item popup is hidden by default
        const item = await driver.findElement(By.id('0,1,i'));
        await assertElementDisplayed(driver, '0,1,i,popup', false);

        // Hover over item
        await driver.actions().move({origin: item}).perform();
        await driver.sleep(DEFAULT_SLEEP);
        // Verify popup is displayed after hover
        await assertElementDisplayed(driver, '0,1,i,popup', true);

        await driver.quit();
    });
    it('Navigate through stations with back button', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);

        // Wait for elements to load
        await driver.sleep(DEFAULT_SLEEP * 2);

        // Navigate to first station
        const station = await driver.findElement(By.id('0,1,s'));
        await station.click();
        await driver.sleep(DEFAULT_SLEEP * 2);

        // Navigate to nested station
        const nestedStation = await driver.findElement(By.id('2,1,s'));
        await nestedStation.click();
        await driver.sleep(DEFAULT_SLEEP * 2);

        // Click back button from nested station
        const nestedBackBtn = await driver.findElement(By.id('back-btn-div'));
        await nestedBackBtn.click();
        await driver.sleep(DEFAULT_SLEEP * 2);

        // Verify we're back at the first station level
        await assertElementDisplayed(driver, '2,1,s', true);

        // Click back button again
        const backBtn = await driver.findElement(By.id('back-btn-div'));
        await backBtn.click();
        await driver.sleep(DEFAULT_SLEEP * 2);

        // Verify we're back at the root level
        await assertElementDisplayed(driver, '0,1,s', true);

        await driver.quit();
    });
    it('When clicking on station a new background should appear with back button', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);

        // Click on the station
        await clickElement(driver, '0,2,s');
        await driver.sleep(DEFAULT_SLEEP);
        // Verify back button is displayed
        await assertElementDisplayed(driver, 'back-btn', true);

        // Click the back button
        await clickElement(driver, 'back-btn');

        // Verify back button div has no children
        const backBtnDiv = await driver.findElement(By.id('back-btn-div'));
        const children = await backBtnDiv.findElements(By.xpath('./*'));
        assert.strictEqual(children.length, 0, 'Back button div should have no children');

        await driver.quit();
    });
    it('Add new Item from context menu', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);
        // Open context menu
        await openContextMenu(driver, 'background');

        // Add new item
        const adItemBtn = await driver.findElement(By.id('adItBtn'));
        const adItemInp = await driver.findElement(By.id('adItInp'));
        await adItemInp.clear();
        await adItemInp.sendKeys('New Item1');
        await adItemBtn.click();

        // Validate title of the new item in HTML
        const itemElement = await driver.findElement(By.id('0,15,i,title'));
        const itemTitle = await itemElement.getAttribute('innerHTML');
        assert.strictEqual(itemTitle, 'New Item1', 'Item title should be New Item1');

        // Validate change in chrome.storage.local
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });

        // Check storage data
        const map = new Map(Object.entries(result));
        assert(map.has('0,15,i'), 'Item with id 0,15,i should be present in storage');

        // Check the title of the item in storage
        const item = map.get('0,15,i');
        assert.strictEqual(item.title, 'New Item1', 'Item title should be New Item1');

        // Check that item with id 0 has item 15 under items array
        const parent = map.get('0');
        assert(parent.items.includes(15), 'Item with id 0 should have item 15 in items array');

        await checkNoConsoleErrors(driver)
        await driver.quit();
    });
    it('Add new Station from context menu', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);

        // Open context menu
        await openContextMenu(driver, 'background');

        // Add a new station
        await clickElement(driver, 'adStBtn');

        // Check for console errors
        await checkNoConsoleErrors(driver);
        await driver.quit();
    });
    it('Add new Dummy from context menu', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);

        // Open context menu
        await openContextMenu(driver, 'background');

        // Add a new dummy
        await clickElement(driver, 'adDumBtn');

        // Check for console errors
        await checkNoConsoleErrors(driver);
        await driver.quit();
    });
    it('Add new Item from context menu and validate the change in html and chrome.storage.local', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);

        // Open context menu and add new item
        await openContextMenu(driver, 'background');
        await clickElement(driver, 'adItBtn');

        // Check for console errors
        await checkNoConsoleErrors(driver);

        // Get storage data
        const result = await getStorageData(driver);
        const map = new Map(Object.entries(result));

        // Validate storage data
        assert(map.has('0,15,i'), 'Item with id 0,15,i should be present in storage');
        const item = map.get('0');
        assert(item.items.includes(15), 'Item with id 0 should have item 15 in items array');

        // Validate HTML element exists
        await assertElementExists(driver, '0,15,i');

        await driver.quit();
    });
    it('Add new Station from context menu and validate the change in html and chrome.storage.local', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);

        // Open context menu and add new station
        await openContextMenu(driver, 'background');
        await clickElement(driver, 'adStBtn');

        // Check for console errors
        await checkNoConsoleErrors(driver);

        // Get storage data
        const result = await getStorageData(driver);
        const map = new Map(Object.entries(result));

        // Validate storage data
        assert(map.has('0,3,s'), 'Station with id 0,3,s should be present in storage');
        const item = map.get('0');
        assert(item.stations.includes(3), 'Item with id 0 should have station 3 in stations array');

        // Validate HTML element exists
        await assertElementExists(driver, '0,3,s');

        await driver.quit();
    });
    it('Add new Dummy from context menu and validate the change in html and chrome.storage.local', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);

        // Open context menu and add new dummy
        await openContextMenu(driver, 'background');
        await clickElement(driver, 'adDumBtn');

        // Check for console errors
        await checkNoConsoleErrors(driver);

        // Get storage data
        const result = await getStorageData(driver);
        const map = new Map(Object.entries(result));

        // Validate storage data
        assert(map.has('0,5,d'), 'Dummy with id 0,5,d should be present in storage');
        const item = map.get('0');
        assert(item.dummies.includes(5), 'Item with id 0 should have dummy 5 in dummies array');

        // Validate HTML element exists
        await assertElementExists(driver, '0,5,d');

        await driver.quit();
    });
    it('Delete Link inside item popup and validate changes', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);

        // Hover over item to show popup
        const item = await driver.findElement(By.id('0,1,i'));
        await driver.actions().move({origin: item}).perform();
        await driver.sleep(DEFAULT_SLEEP);

        // Right-click on link to open context menu
        const link = await driver.findElement(By.id('0,1,i,3'));
        await driver.actions().contextClick(link).perform();

        // Click on remove link option
        await assertElementDisplayed(driver, 'remLi', true);
        await clickElement(driver, 'remLi');

        // Confirm deletion
        await driver.switchTo().alert().accept();

        // Verify link is removed from HTML
        const linkExists = await elementExists(driver, '0,1,i,3');
        assert(!linkExists, 'Link with id 0,1,i,3 should not be present in html');

        // Check for console errors
        await checkNoConsoleErrors(driver);

        // Verify link is removed from storage
        const result = await getStorageData(driver);
        const map = new Map(Object.entries(result));
        assert(!map.has('0,1,i,3'), 'Link with id 0,1,i,3 should not be present in storage');

        // Open trash from context menu
        await openContextMenu(driver, 'background');
        await clickElement(driver, 'shTrash');

        // Verify trash popup is displayed
        await assertElementDisplayed(driver, 'trash-popup', true);
        await driver.sleep(DEFAULT_SLEEP);
        // Check the number of items in trash
        const trashPopupContent = await driver.findElement(By.id('trash,popup-content'));
        await driver.sleep(DEFAULT_SLEEP);
        const children = await trashPopupContent.findElements(By.xpath('./*'));
        assert.strictEqual(children.length, 61, 'Trash popup should have 26 children');

        await driver.quit();
    });
    it('Change Link icon inside item popup and validate changes', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);

        // Hover over item to show popup
        const item = await driver.findElement(By.id('0,1,i'));
        await driver.actions().move({origin: item}).perform();
        await driver.sleep(DEFAULT_SLEEP);

        // Get link and current icon
        const link = await driver.findElement(By.id('0,1,i,3'));
        const childImg = await link.findElement(By.tagName('img'));
        const iconBefore = await childImg.getAttribute('src');

        // Right-click on link to open context menu
        await driver.actions().contextClick(link).perform();

        // Click on change icon option
        await clickElement(driver, 'chgIc');
        await driver.sleep(DEFAULT_SLEEP);

        // Verify gifs popup is displayed
        await assertElementDisplayed(driver, 'gifs-popup', true);

        // Select first gif as new icon
        const gifLink = await driver.findElement(By.css('#gifs\\,popup-content a:first-child'));
        const childGifLinkImg = await gifLink.findElement(By.tagName('img'));
        const gifsLinkIcon = await childGifLinkImg.getAttribute('src');
        await gifLink.click();
        await driver.sleep(DEFAULT_SLEEP);

        // Verify icon has changed in HTML
        const linkElement = await driver.findElement(By.id('0,1,i,3'));
        const childAfterImg = await linkElement.findElement(By.tagName('img'));
        const iconAfter = await childAfterImg.getAttribute('src');
        assert.strictEqual(gifsLinkIcon, iconAfter, 'Icons should be same in HTML');

        // Check for console errors
        await checkNoConsoleErrors(driver);

        // Verify icon has changed in storage
        const result = await getStorageData(driver);
        const map = new Map(Object.entries(result));
        assert(map.has('0,1,i,3'), 'Link with id 0,1,i,3 should be present in storage');
        assert.strictEqual(gifsLinkIcon, map.get('0,1,i,3').icon, 'Icons should be same in storage');

        await driver.quit();
    });
    it('Change Link icon 0,1,i,3 inside items`s popup then reset the icon for the link and validate the changes in html and chrome.storage.local', async function () {
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);
        const item = await driver.findElement(By.id('0,1,i'));
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const map = new Map(Object.entries(result));
        assert(map.has('0,1,i,3'), 'Link with id 0,1,i,3 should present in storage');
        const iconBefore = map.get('0,1,i,3').icon;
        await driver.actions().move({origin: item}).perform();
        await driver.sleep(DEFAULT_SLEEP)
        const link = await driver.findElement(By.id('0,1,i,3'));
        const childImg = await link.findElement(By.tagName('img'));
        const htmlIconBefore = await childImg.getAttribute('src');
        // Trigger the contextmenu event
        await driver.actions().contextClick(link).perform();

        // Wait for the context menu to appear and verify its presence
        const chgIckMenu = await driver.findElement(By.id('chgIc'));

        await chgIckMenu.click();
        await driver.sleep(DEFAULT_SLEEP);
        //pick a new icon from gifs popup
        const openGifsPopup = await driver.findElement(By.id('gifs-popup'));
        assert(await openGifsPopup.isDisplayed(), 'Gifs popup should be displayed');
        //drag and drop first a link from div with id open-tabs,popup-content to the item id 0,1,i
        const gifLink = await driver.findElement(By.css('#gifs\\,popup-content a:first-child'));
        const childGifLinkImg = await gifLink.findElement(By.tagName('img'));
        const gifsLinkIcon = await childGifLinkImg.getAttribute('src');
        await gifLink.click();
        await driver.sleep(DEFAULT_SLEEP);
        //check that link with id 0,1,i,3 is present in the html
        let linkElement = await driver.findElement(By.id('0,1,i,3'));
        const childAfterImg = await linkElement.findElement(By.tagName('img'));
        const iconAfter = await childAfterImg.getAttribute('src');
        //compare icons
        assert.strictEqual(gifsLinkIcon, iconAfter, 'Icons should be same');
        //reset the icon for the link
        await driver.actions().move({origin: item}).perform();
        await driver.sleep(DEFAULT_SLEEP)
        const linkAfter = await driver.findElement(By.id('0,1,i,3'));
        const childImgAfter = await linkAfter.findElement(By.tagName('img'));
        const iconBeforeAfter = await childImgAfter.getAttribute('src');
        // Trigger the contextmenu event
        await driver.actions().contextClick(linkAfter).perform();

        // Wait for the context menu to appear and verify its presence
        const chgIckMenuAfter = await driver.findElement(By.id('chgIc'));

        await chgIckMenuAfter.click();
        await driver.sleep(DEFAULT_SLEEP);
        //pick a new icon from gifs popup
        const openGifsPopupAfter = await driver.findElement(By.id('gifs-popup'));
        assert(await openGifsPopupAfter.isDisplayed(), 'Gifs popup should be displayed');
        const resetButton = await driver.findElement(By.id('reset-btn'));
        await resetButton.click();

        const resultAfter = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        //check that id 0,1,i,3 exists in the storage
        const mapAfter = new Map(Object.entries(resultAfter));
        assert(mapAfter.has('0,1,i,3'), 'Link with id 0,1,i,3 should present in storage');
        assert.strictEqual(iconBefore, mapAfter.get('0,1,i,3').icon, 'Icons should be same');
        await checkNoConsoleErrors(driver);
        await driver.quit();
    });
    it('Change Link icon 0,1,i,3 inside items`s popup with a new added icon and validate the change in html and chrome.storage.local', async function () {
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);
        const item = await driver.findElement(By.id('0,1,i'));

        await driver.actions().move({origin: item}).perform();
        await driver.sleep(DEFAULT_SLEEP)
        const link = await driver.findElement(By.id('0,1,i,3'));
        const childImg = await link.findElement(By.tagName('img'));
        // Trigger the contextmenu event
        await driver.actions().contextClick(link).perform();

        // Wait for the context menu to appear and verify its presence
        const chgIckMenu = await driver.findElement(By.id('chgIc'));

        await chgIckMenu.click();
        await driver.sleep(DEFAULT_SLEEP);
        const addGifBtn = await driver.findElement(By.id('add-new-link-btn'));

        const gifUrlInput = await driver.findElement(By.id('new-link-inp'));
        await gifUrlInput.sendKeys('https://png.pngtree.com/png-vector/20221013/ourmid/pngtree-calendar-icon-logo-2023-date-time-png-image_6310337.png');
        await addGifBtn.click();
        //show GIFs popup
        const gif1 = await driver.findElement(By.id('gifs,51'));
        assert(gif1, 'Gif with id gifs,51 should be present in the html');
        //get gif1 src
        const gif1Src = await gif1.getAttribute('src');
        await gif1.click();
        await driver.sleep(DEFAULT_SLEEP);
        //check chrome open tabs number is 1
        const openTabsCount = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.tabs.query({}, (tabs) => {
                    resolve(tabs.length);
                });
            });
        });
        assert.strictEqual(openTabsCount, 1, 'There should be exactly 1 open tab in Chrome');
        //drag and drop first a link from div with id open-tabs,popup-content to the item id 0,1,i
        const gifLink = await driver.findElement(By.css('#gifs\\,popup-content a:first-child'));
        const childGifLinkImg = await gifLink.findElement(By.tagName('img'));
        const gifsLinkIcon = await childGifLinkImg.getAttribute('src');
        await gifLink.click();
        await driver.sleep(DEFAULT_SLEEP);
        //check that link with id 0,1,i,3 is present in the html
        let linkElement = await driver.findElement(By.id('0,1,i,3'));
        const childAfterImg = await linkElement.findElement(By.tagName('img'));
        const iconAfter = await childAfterImg.getAttribute('src');
        //compare icons
        assert.strictEqual(gifsLinkIcon, iconAfter, 'Icons should be same');
        await checkNoConsoleErrors(driver);
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        //check that id 0,1,i,3 exists in the storage
        const map = new Map(Object.entries(result));
        assert(map.has('0,1,i,3'), 'Link with id 0,1,i,3 should not be present in storage');
        assert.strictEqual(gifsLinkIcon, map.get('0,1,i,3').icon, 'Icons should be same');

        await driver.quit();
    });
    it('Delete Item 0,1,i and validate the change in html , trash and chrome.storage.local', async function () {
        let driver = await buildDriver()
        await driver.sleep(DEFAULT_SLEEP);
        const item = await driver.findElement(By.id('0,1,i'));

        await driver.actions().move({origin: item}).perform();
        await driver.sleep(DEFAULT_SLEEP);

        // Trigger the contextmenu event
        await driver.actions().contextClick(item).perform();
        await driver.sleep(DEFAULT_SLEEP);
        // Wait for the context menu to appear and verify its presence
        const remItemMenu = await driver.findElement(By.id('remItem'));

        assert(await remItemMenu.isDisplayed(), 'Remove Item menu should be displayed');
        await driver.sleep(DEFAULT_SLEEP);
        await remItemMenu.click();
        await driver.sleep(DEFAULT_SLEEP);
        //confirm the deletion prompt by clicking on The Alert confirm button
        await driver.switchTo().alert().accept();

        //check that item with id 0,1,i is not present in the html
        let itemElement;
        try {
            itemElement = await driver.findElement(By.id('0,1,i'));
        } catch (e) {
            itemElement = null;
        }
        assert(!itemElement, 'Item with id 0,1,i should be not present in html');
        await checkNoConsoleErrors(driver);
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        //check that id 0,1,i exists in the storage
        const map = new Map(Object.entries(result));
        assert(!map.has('0,1,i'), 'Item with id 0,1,i should not be present in storage');
        //show trash from a context menu
        const background = await driver.findElement(By.id('background'));
        // Trigger the contextmenu event
        await driver.actions().contextClick(background).perform();
        const showTrash = await driver.findElement(By.id('shTrash'));
        await showTrash.click();
        await driver.sleep(DEFAULT_SLEEP);
        //the trash-popup is visible
        const trashPopup = await driver.findElement(By.id('trash-popup'));
        assert(await trashPopup.isDisplayed(), 'Trash popup should be displayed');
        //check the number of items in the div with id "trash,popup-content" should be 28
        const trashPopupContent = await driver.findElement(By.id('trash,popup-content'));
        const children = await trashPopupContent.findElements(By.xpath('./*'));
        assert.strictEqual(children.length, 69, 'Trash popup should have 28 children');

        await driver.quit();
    });
    it('Delete Empty Station 0,1,s and validate the change in html , trash and chrome.storage.local', async function () {})
    it('Delete Dummy 0,1,d and validate the change in html and chrome.storage.local', async function () {
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);

        const dummy = await driver.findElement(By.id('0,1,d'));

        await driver.actions().move({origin: dummy}).perform();

        // Trigger the contextmenu event
        await driver.actions().contextClick(dummy).perform();

        // Wait for the context menu to appear and verify its presence
        const remDummyMenu = await driver.findElement(By.id('remDummy'));

        assert(await remDummyMenu.isDisplayed(), 'Remove Dummy menu should be displayed');

        await remDummyMenu.click();
        //confirm the deletion prompt by clicking on The Alert confirm button
        await driver.switchTo().alert().accept();

        //check that dummy with id 0,1,d is not present in the html
        let dummyElement;
        try {
            dummyElement = await driver.findElement(By.id('0,1,d'));
        } catch (e) {
            dummyElement = null;
        }
        assert(!dummyElement, 'Dummy with id 0,1,d should be not present in html');
        await checkNoConsoleErrors(driver);
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        //check that id 0,1,d exists in the storage
        const map = new Map(Object.entries(result));
        assert(!map.has('0,1,d'), 'Dummy with id 0,1,d should not be present in storage');
        assert(!map.get('0').dummies.includes(1), 'Item with id 0 should not have dummy 1 in dummies array');
        await driver.quit();
    });
    it('Try to Delete Station 0,1,s and validate no change in html and chrome.storage.local', async function () {
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);
        const station = await driver.findElement(By.id('0,1,s'));

        await driver.actions().move({origin: station}).perform();

        // Trigger the contextmenu event
        await driver.actions().contextClick(station).perform();

        // Wait for the context menu to appear and verify its presence
        const remStationMenu = await driver.findElement(By.id('remStation'));

        await remStationMenu.click();
        //confirm the deletion prompt by clicking on The Alert confirm button
        await driver.switchTo().alert().accept();
        await driver.switchTo().alert().accept();

        //check that station with id 0,1,s is present in the html
        let stationElement;
        try {
            stationElement = await driver.findElement(By.id('0,1,s'));
        } catch (e) {
            stationElement = null;
        }
        assert(stationElement, 'Station with id 0,1,s should be present in html');
        await checkNoConsoleErrors(driver);
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        //check that id 0,1,s exists in the storage
        const map = new Map(Object.entries(result));
        assert(map.has('0,1,s'), 'Station with id 0,1,s should be present in storage');
        assert(map.get('0').stations.includes(1), 'Item with id 0 should have station 1 in stations array');
        await driver.quit();
    });
    it('Show Gifs popup from context menu and add new image link to gifs and validate the change in html and chrome.storage.local', async function () {
        //show GIFs popup from a context menu
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);

        const background = await driver.findElement(By.id('background'));
        // Trigger the contextmenu event
        await driver.actions().contextClick(background).perform();
        const showGifs = await driver.findElement(By.id('shGifs'));
        await showGifs.click();
        const gifsPopup = await driver.findElement(By.id('gifs-popup'));
        assert(await gifsPopup.isDisplayed(), 'Gifs popup should be displayed');
        //add new image to gifs
        const addGifBtn = await driver.findElement(By.id('add-new-link-btn'));

        const gifUrlInput = await driver.findElement(By.id('new-link-inp'));
        await gifUrlInput.sendKeys('https://media2.giphy.com/media/QxdbjzetcgDImLeeSO/giphy.gif?cid=6c09b9529fexph9gmkq1i1etgfvxrv5xxq7hswdkkiol8tbu&ep=v1_internal_gif_by_id&rid=giphy.gi');
        await addGifBtn.click();
        await checkNoConsoleErrors(driver);
        //check that gif with id gifs,10 exists in the html
        const gifElement = await driver.findElement(By.id('gifs,10'));
        assert(gifElement, 'Gif with id gifs,10 should be present in the html');
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        //check that id gifs,10 exists in the storage
        const map = new Map(Object.entries(result));
        assert(map.has('gifs,10'), 'Gif with id gifs,10 should be present in storage');
        //check that the id 10 is under gifs.links array in the storage
        const gifs = map.get('gifs');
        assert(gifs.links.includes(10), 'Gif with id 10 should be present in gifs.links array in storage');
        await driver.quit();
    });
    it('Show Gifs popup from context menu and add/remove new image link to gifs several times and validate the change in html and chrome.storage.local', async function () {
        //show GIFs popup from a context menu
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);

        const background = await driver.findElement(By.id('background'));
        // Trigger the contextmenu event
        await driver.actions().contextClick(background).perform();
        const showGifs = await driver.findElement(By.id('shGifs'));
        await showGifs.click();
        const gifsPopup = await driver.findElement(By.id('gifs-popup'));
        assert(await gifsPopup.isDisplayed(), 'Gifs popup should be displayed');
        //add new image to gifs
        const addGifBtn = await driver.findElement(By.id('add-new-link-btn'));

        const gifUrlInput = await driver.findElement(By.id('new-link-inp'));
        await gifUrlInput.sendKeys('https://media2.giphy.com/media/QxdbjzetcgDImLeeSO/giphy.gif?cid=6c09b9529fexph9gmkq1i1etgfvxrv5xxq7hswdkkiol8tbu&ep=v1_internal_gif_by_id&rid=giphy.gi');
        await addGifBtn.click();
        await checkNoConsoleErrors(driver);
        //check that gif with id gifs,10 exists in the html
        const gifElement = await driver.findElement(By.id('gifs,10'));
        assert(gifElement, 'Gif with id gifs,10 should be present in the html');
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        //check that id gifs,10 exists in the storage
        const map = new Map(Object.entries(result));
        assert(map.has('gifs,10'), 'Gif with id gifs,10 should be present in storage');
        //check that the id 10 is under gifs.links array in the storage
        const gifs = map.get('gifs');
        assert(gifs.links.includes(10), 'Gif with id 10 should be present in gifs.links array in storage');
        await driver.quit();
    });
    it('Show Gifs popup from context menu and add new invalid image link to gifs and validate the change in html and chrome.storage.local', async function () {
        //show Gifs popup from context menu
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);
        const background = await driver.findElement(By.id('background'));
        // Trigger the contextmenu event
        await driver.actions().contextClick(background).perform();
        const showGifs = await driver.findElement(By.id('shGifs'));
        await showGifs.click();
        const gifsPopup = await driver.findElement(By.id('gifs-popup'));
        assert(await gifsPopup.isDisplayed(), 'Gifs popup should be displayed');
        //add new image to gifs
        const addGifBtn = await driver.findElement(By.id('add-new-link-btn'));

        const gifUrlInput = await driver.findElement(By.id('new-link-inp'));
        await gifUrlInput.sendKeys('https://media2.giphy.com/media/QxdbjzetcgDImLeeSO/');
        await addGifBtn.click();
        await checkNoConsoleErrors(driver);        //check that gif with id gifs,10 exists in the html
        const gifElement = await driver.findElement(By.id('gifs,10'));
        assert(gifElement, 'Gif with id gifs,10 should be present in the html');
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        //check that id gifs,10 exists in the storage
        const map = new Map(Object.entries(result));
        assert(map.has('gifs,10'), 'Gif with id gifs,10 should be present in storage');
        //check that the id 10 is under gifs.links array in the storage
        const gifs = map.get('gifs');
        assert(gifs.links.includes(10), 'Gif with id 10 should be present in gifs.links array in storage');
        await driver.quit();
    });
    it('Add new Item and assign and add new gif from gifs popup and validate the change in html and chrome.storage.local', async function () {
        //show GIFs popup from the context menu
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);

        const background = await driver.findElement(By.id('background'));
        //Add item
        await driver.actions().contextClick(background).perform();
        const adItemBtn = await driver.findElement(By.id('adItBtn'));
        const adItemInp = await driver.findElement(By.id('adItInp'));
        await adItemInp.clear();
        await adItemInp.sendKeys('New Item1');
        await adItemBtn.click();
        const item = await driver.findElement(By.id('0,15,i'));
        await driver.actions().contextClick(item).perform();
        //Click on the change icon button
        const changeIconBtn = await driver.findElement(By.id('chgObjIc'));
        await changeIconBtn.click();
        const gifsPopup = await driver.findElement(By.id('gifs-popup'));
        assert(await gifsPopup.isDisplayed(), 'Gifs popup should be displayed');
        //add new image to gifs
        const addGifBtn = await driver.findElement(By.id('add-new-link-btn'));

        const gifUrlInput = await driver.findElement(By.id('new-link-inp'));
        await gifUrlInput.sendKeys('https://media2.giphy.com/media/QxdbjzetcgDImLeeSO/giphy.gif?cid=6c09b9529fexph9gmkq1i1etgfvxrv5xxq7hswdkkiol8tbu&ep=v1_internal_gif_by_id&rid=giphy.gi');
        await addGifBtn.click();
        const gif1 = await driver.findElement(By.id('gifs,64'));
        await driver.actions().contextClick(gif1).perform();
        const removeLink = await driver.findElement(By.id('remLi'));
        const closeBtn = await driver.findElement(By.id('close-btn'));
        assert(removeLink, 'Gif with id gifs,64 should be present in the html');
        await closeBtn.click();
        assert(gif1, 'Gif with id gifs,64 should be present in the html');
        const gif1Img = await driver.findElement(By.id('gifs,64,img'));
        const gif1Src = await gif1Img.getAttribute('src');
        await gif1.click();
        await driver.sleep(DEFAULT_SLEEP);
        //check in HTML that the number of 0,15,i,img is the new added gif
        const itemImg4 = await driver.findElement(By.id('0,15,i,img'));
        const imgSrc4 = await itemImg4.getAttribute('src');
        assert(imgSrc4 === gif1Src, 'The new added gif should be the src of the img');
        await checkNoConsoleErrors(driver);
        await driver.sleep(DEFAULT_SLEEP);
        //check that GIF with id gifs,10 exists in the html
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        //check that id gifs,10 exists in the storage
        const map = new Map(Object.entries(result));
        assert(map.has('gifs,64'), 'Gif with id gifs,64 should be present in storage');
        const gif64 = map.get('gifs,64');
        //check that item with id 0,15,i exists in the storage, and his link is 64 (gifs,64)
        const itemInStorage = map.get('0,15,i');
        assert(itemInStorage.icon === gif64.link, 'Item with id 0,15,i should have link 64 in storage');
        //check that the id 10 is under gifs.links array in the storage
        const gifs = map.get('gifs');
        assert(gifs.links.includes(64), 'Gif with id 64 should be present in gifs.links array in storage');
        await driver.quit();
    });
    it('change background from the context menu', async function () {
        let driver = buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);

        await driver.quit();
    });
    it('change object icon from the gifs popup', async function () {
        let driver = buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);

        await driver.quit();
    });
    it('change object icon from the gifs popup several times by adding and removing icons validate the change in html and chrome.storage.local', async function () {
        let driver = buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);

        await driver.quit();
    });
    it('drag drop new image from backgrounds popup to the background', async function () {
        let driver = buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);

        await driver.quit();
    });
    it('Validate image before adding to Gifs dialog', async function () {
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(2000);
        // Open GIFs dialog from context menu
        await driver.actions().contextClick(await driver.findElement(By.id('background'))).perform();
        const showGifs = await driver.findElement(By.id('shGifs'));
        await showGifs.click();
        const gifsPopup = await driver.findElement(By.id('gifs-popup'));
        assert(await gifsPopup.isDisplayed(), 'Gifs popup should be displayed');

        // Add new image to GIFs
        const addGifBtn = await driver.findElement(By.id('add-new-link-btn'));
        const gifUrlInput = await driver.findElement(By.id('new-link-inp'));
        await gifUrlInput.sendKeys('invalid image url');
        await addGifBtn.click();
        // Validate image not added to gifs dialog or local storage
        const invalidGifId = await driver.findElement(By.id('gifs,64'));
        const invalidGifImg = await invalidGifId.findElement(By.tagName('img'));
        const invalidGifSrc = await invalidGifImg.getAttribute('src');
        assert.strictEqual(await invalidGifId.isDisplayed(), true, 'Invalid image should be displayed in the gifs dialog');
        const includeResult = invalidGifSrc.includes("images/default-link.webp");
        assert.strictEqual(includeResult, true, 'Invalid image should be displayed in the gifs dialog');
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const map = new Map(Object.entries(result));
        const hasInvalidGif = Array.from(map.values()).some(
            v => v && typeof v === 'object' && v.link === 'invalid image url'
        );
        assert.strictEqual(hasInvalidGif, true, 'Invalid image should be present in local storage');
        await checkNoConsoleErrors(driver);
        await driver.quit();
    });
    it('drag drop new icon from gifs popup to the object', async function () {
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);
        await driver.sleep(2000);

        await driver.quit();
    });
    it('Drag and drop item 0,1,i and validate change in chrome.storage.local and html', async function () {
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);

        const item = await driver.findElement(By.id('0,1,i'));
        //get HTML position of div with id 0,1,i
        const itemLocation = await item.getRect();
        //get item position id 0,1,i from chrome.storage.local
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const map = new Map(Object.entries(result));
        const itemPosition = map.get('0,1,i');
        //hover over item 0,1,i
        await driver.actions().move({origin: item}).perform();
        //find item`s titles 0,1,i,t
        const itemTitle = await driver.findElement(By.id('0,1,i,title'));
        //drag and drop itemTitle 0,1,i,t 50px right and 50px down
        await driver.actions().dragAndDrop(itemTitle, {x: 50, y: 50}).perform();
        //capture position of item 0,1,i after move
        const itemLocationAfterMove = await item.getRect();
        //validate that item 0,1,i moved 50px right and 50px down
        assert(itemLocation.x + 50 === itemLocationAfterMove.x, 'Item 0,1,i should be moved 50px right');
        assert(itemLocation.y + 50 === itemLocationAfterMove.y, 'Item 0,1,i should be moved 50px down');
        //check if item 0,1,i position is updated in chrome.storage.local
        const resultAfterMove = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const mapAfterMove = new Map(Object.entries(resultAfterMove));
        const itemPositionAfterMove = mapAfterMove.get('0,1,i');
        assert(parseInt(itemPosition.left.replace('px', '')) + 50 === parseInt(itemPositionAfterMove.left.replace('px', '')), 'Item 0,1,i should be moved 50px right in storage');
        assert(parseInt(itemPosition.top.replace('px', '')) + 50 === parseInt(itemPositionAfterMove.top.replace('px', '')), 'Item 0,1,i should be moved 50px down in storage');
        //check no error in console logs
        await checkNoConsoleErrors(driver);
        await driver.quit();

    });
    it('Drag and drop station 0,1,s and validate change in chrome.storage.local and html', async function () {
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);

        const station = await driver.findElement(By.id('0,1,s'));
        //get HTML position of div with id 0,1,s
        const stationLocation = await station.getRect();
        //get station position id 0,1,s from chrome.storage.local
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const map = new Map(Object.entries(result));
        const stationPosition = map.get('0,1,s');
        //hover over station 0,1,s
        await driver.actions().move({origin: station}).perform();
        //find station`s titles 0,1,s,t
        const stationTitle = await driver.findElement(By.id('0,1,s,title'));
        //drag and drop stationTitle 0,1,s,title 50px right and 50px down
        await driver.actions().dragAndDrop(stationTitle, {x: 50, y: 50}).perform();
        //capture position of station 0,1,s after move
        const stationLocationAfterMove = await station.getRect();
        //validate that station 0,1,s moved 50px right and 50px down
        assert(stationLocation.x + 50 === stationLocationAfterMove.x, 'Station 0,1,s should be moved 50px right');
        assert(stationLocation.y + 50 === stationLocationAfterMove.y, 'Station 0,1,s should be moved 50px down');
        //check if station 0,1,s position is updated in chrome.storage.local
        const resultAfterMove = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const mapAfterMove = new Map(Object.entries(resultAfterMove));
        const stationPositionAfterMove = mapAfterMove.get('0,1,s');
        assert(parseInt(stationPosition.left.replace('px', '')) + 50 === parseInt(stationPositionAfterMove.left.replace('px', '')), 'Station 0,1,s should be moved 50px right in storage');
        assert(parseInt(stationPosition.top.replace('px', '')) + 50 === parseInt(stationPositionAfterMove.top.replace('px', '')), 'Station 0,1,s should be moved 50px down in storage');
        //check no error in console logs
        await checkNoConsoleErrors(driver);
        await driver.quit();
    });
    it('Drag and drop dummy 0,1,d and validate change in chrome.storage.local and html', async function () {
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);

        const dummy = await driver.findElement(By.id('0,1,d'));
        //get HTML position of div with id 0,1,d
        const dummyLocation = await dummy.getRect();
        //get dummy position id 0,1,d from chrome.storage.local
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const map = new Map(Object.entries(result));
        const dummyPosition = map.get('0,1,d');
        //hover over dummy 0,1,d
        await driver.actions().move({origin: dummy}).perform();
        //find dummy`s titles 0,1,d,title
        const dummyTitle = await driver.findElement(By.id('0,1,d,title'));
        //drag and drop dummyTitle 0,1,d,title 50px right and 50px down
        await driver.actions().dragAndDrop(dummyTitle, {x: 50, y: 50}).perform();
        //capture position of dummy 0,1,d after move
        const dummyLocationAfterMove = await dummy.getRect();
        //validate that dummy 0,1,d moved 50px right and 50px down
        assert(dummyLocation.x + 50 === dummyLocationAfterMove.x, 'Dummy 0,1,d should be moved 50px right');
        assert(dummyLocation.y + 50 === dummyLocationAfterMove.y, 'Dummy 0,1,d should be moved 50px down');
        //check if dummy 0,1,d position is updated in chrome.storage.local
        const resultAfterMove = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const mapAfterMove = new Map(Object.entries(resultAfterMove));
        const dummyPositionAfterMove = mapAfterMove.get('0,1,d');
        assert(parseInt(dummyPosition.left.replace('px', '')) + 50 === parseInt(dummyPositionAfterMove.left.replace('px', '')), 'Dummy 0,1,d should be moved 50px right in storage');
        assert(parseInt(dummyPosition.top.replace('px', '')) + 50 === parseInt(dummyPositionAfterMove.top.replace('px', '')), 'Dummy 0,1,d should be moved 50px down in storage');
        //check no error in console logs
        await checkNoConsoleErrors(driver);
        await driver.quit();
    });
    it('Drag and drop link open tabs to item and validate change in chrome.storage.local and html', async function () {
        //open new tabs with www.amazon.com, www.ebay.com, www.etsy.com
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);

        await driver.executeScript('window.open("https://www.amazon.com")');
        await driver.executeScript('window.open("https://www.ebay.com")');
        //focus on the first opened tab
        await driver.sleep(DEFAULT_SLEEP);
        const handles = await driver.getAllWindowHandles();
        await driver.switchTo().window(handles[0]);
        //open the context menu on the first tab
        const background = await driver.findElement(By.id('background'));
        // Trigger the contextmenu event
        await driver.actions().contextClick(background).perform();
        // Wait for the context menu to appear and verify its presence
        //show open tabs popup
        const openTabs = await driver.findElement(By.id('shTab'));
        await openTabs.click();
        const openTabsPopup = await driver.findElement(By.id('open-tabs-popup'));
        assert(await openTabsPopup.isDisplayed(), 'Open tabs popup should be displayed');
        //drag and drop first a link from div with id open-tabs,popup-content to the item id 0,1,i
        const link = await driver.findElement(By.css('#open-tabs\\,popup-content a:first-child'));
        await driver.sleep(DEFAULT_SLEEP);
        const item = await driver.findElement(By.id('0,1,i'));
        await driver.sleep(DEFAULT_SLEEP);
        await driver.actions().dragAndDrop(link, item).perform();
        await driver.sleep(DEFAULT_SLEEP);

        //check in html and chrome.storage.local that the number of 0,1,i,popup-content of item 0,1,i children is 4
        const itemPopup = await driver.findElement(By.id('0,1,i,popup-content'));

        //check that item popup has 4 children

        const children = await itemPopup.findElements(By.xpath('./*'));
        assert.strictEqual(children.length, 10, 'Item popup should have 10 children');
        //check that the item 0,1,i has 4 links in the storage
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const map = new Map(Object.entries(result));
        const itemAfter = map.get('0,1,i');
        assert.strictEqual(itemAfter.links.length, 10, 'Item 0,1,i should have 10 links in storage');
        //check in chrome.storage.local that the item 0,1,i,4 exists
        const newLink = map.get('0,1,i,4');
        console.assert(newLink, 'Link with id 0,1,i,4 should be present in storage');
        //check no error in console logs
        await checkNoConsoleErrors(driver);
        await driver.quit();
    });
    it('Drag and drop link from trash to item 0,1,i and validate change in chrome.storage.local and html', async function () {
        //open new tabs with www.amazon.com, www.ebay.com, www.etsy.com
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);

        //open context menu
        const background = await driver.findElement(By.id('background'));
        // Trigger the contextmenu event
        await driver.actions().contextClick(background).perform();
        // Wait for the context menu to appear and verify its presence
        //show open tabs popup
        const openTrash = await driver.findElement(By.id('shTrash'));
        await openTrash.click();
        const openTrashPopup = await driver.findElement(By.id('trash-popup'));
        assert(await openTrashPopup.isDisplayed(), 'Trash popup should be displayed');
        //drag and drop first a link from div with id open-tabs,popup-content to the item id 0,1,i
        const link = await driver.findElement(By.css('#trash\\,popup-content a:first-child'));
        const item = await driver.findElement(By.id('0,1,i'));
        await driver.sleep(DEFAULT_SLEEP);

        await driver.actions().dragAndDrop(link, item).perform();
        await driver.sleep(DEFAULT_SLEEP);

        //check in html and chrome.storage.local that the number of 0,1,i,popup-content of item 0,1,i children is 4
        const itemPopup = await driver.findElement(By.id('0,1,i,popup-content'));

        //check that item popup has 4 children

        const children = await itemPopup.findElements(By.xpath('./*'));
        assert.strictEqual(children.length, 10, 'Item popup should have 10 children');
        //check that the item 0,1,i has 4 links in the storage
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const map = new Map(Object.entries(result));
        const itemAfter = map.get('0,1,i');
        assert.strictEqual(itemAfter.links.length, 10, 'Item 0,1,i should have 10 links in storage');
        //check in chrome.storage.local that the item 0,1,i,4 exists
        const newLink = map.get('0,1,i,10');
        console.assert(newLink, 'Link with id 0,1,i,10 should be present in storage');
        //check no error in console logs
        await checkNoConsoleErrors(driver);
        await driver.quit();
    });
    it('Drag and drop link from history to item 0,1,i and validate change in chrome.storage.local and html', async function () {});
    it('Search in history dialog and validate change in html', async function () {});
    it('Use favicon toggle switch in history dialog and validate changes in html and storage', async function () {});
    it('Use favicon toggle switch in openTabs dialog and validate changes in html and storage', async function () {});
    it('Use favicon toggle switch in bookmarks dialog and validate changes in html and storage', async function () {});
    it('Use favicon toggle switch in Item dialog and validate changes in html and storage', async function () {});
    it('Use favicon toggle switch in Item links dialog and validate changes in html and storage', async function () {});
    it('Try adding new icon for link in item popup few times, remove also and validate in html and storage', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver);
        await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);
        //open context menu
        const background = await driver.findElement(By.id('background'));
        // Trigger the contextmenu event
        await driver.actions().move({origin: background}).contextClick().perform();        // Wait for the context menu to appear and verify its presence
        //show open tabs popup
        const openGifs = await driver.findElement(By.id('shGifs'));
        await openGifs.click();
        const openGifsPopup = await driver.findElement(By.id('gifs-popup'));
        assert(await openGifsPopup.isDisplayed(), 'Gifs popup should be displayed');
        await driver.sleep(DEFAULT_SLEEP);
        //add new image to GIFs
        const addGifBtn = await driver.findElement(By.id('add-new-link-btn'));
        const gifUrlInput = await driver.findElement(By.id('new-link-inp'));
        await gifUrlInput.sendKeys('https://media2.giphy.com/media/QxdbjzetcgDImLeeSO/giphy.gif?cid=6c09b9529fexph9gmkq1i1etgfvxrv5xxq7hswdkkiol8tbu&ep=v1_internal_gif_by_id&rid=giphy.gi');
        await addGifBtn.click();
        await driver.sleep(DEFAULT_SLEEP);
        const gif1 = await driver.findElement(By.id('gifs,64'));
        await driver.actions().contextClick(gif1).perform();
        let removeLink = await driver.findElement(By.id('remLi'));
        await removeLink.click();
        await driver.switchTo().alert().accept();
        await driver.sleep(DEFAULT_SLEEP);
        //clear text in gifUrlInput
        //add again a new image to gifs
        await gifUrlInput.sendKeys('https://media2.giphy.com/media/QxdbjzetcgDImLeeSO/giphy.gif?cid=6c09b9529fexph9gmkq1i1etgfvxrv5xxq7hswdkkiol8tbu&ep=v1_internal_gif_by_id&rid=giphy.gi');
        await addGifBtn.click();
        await driver.sleep(DEFAULT_SLEEP);
        const gif2 = await driver.findElement(By.id('gifs,64'));
        await driver.actions().contextClick(gif2).perform();
        removeLink = await driver.findElement(By.id('remLi'));
        await removeLink.click();
        await driver.switchTo().alert().accept();
        await driver.sleep(DEFAULT_SLEEP);
        //add again a new image to GIFs
        await gifUrlInput.sendKeys('https://media2.giphy.com/media/QxdbjzetcgDImLeeSO/giphy.gif?cid=6c09b9529fexph9gmkq1i1etgfvxrv5xxq7hswdkkiol8tbu&ep=v1_internal_gif_by_id&rid=giphy.gi');
        await addGifBtn.click();
        const gif3 = await driver.findElement(By.id('gifs,64'));
        assert(gif3, 'Gif with id gifs,64 should exist in the html');
        //close the GIFs popup
        const overlay1 = await driver.findElement(By.id('overlay'));
        await driver.actions().move({x: 0, y: -320, origin: overlay1}).click().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //open again GIFs popup
        await driver.actions().contextClick(background).perform();
        const openGifs2 = await driver.findElement(By.id('shGifs'));
        await openGifs2.click();

        //validate in local storage
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const map = new Map(Object.entries(result));
        assert(map.has('gifs,64'), 'Gif with id gifs,64 should be present in storage');
        assert(map.get('gifs').links.includes(64), 'Gif with id gifs,64 should be present in gifs.links array');
        const overlay2 = await driver.findElement(By.id('overlay'));
        await driver.actions().move({x: 0, y: -320, origin: overlay2}).click().perform();
        await checkNoConsoleErrors(driver);
        await driver.quit();

    });
    it('Check search input search with all features and arrow navigation', async function () {});
    it('Check failed to load image https://img.clipart-library.com/2/clip-transparent-butterfly-gif/clip-transparent-butterfly-gif-3.gif and display something else', async function () {});
    it('Search in item dialog and validate change in html', async function () {});
    it('Search in Bookmarks dialog and validate change in html', async function () {});
    it('Search in Reading list dialog and validate change in html', async function () {});
    it('Search in Trash dialog and validate change in html', async function () {});
    it('Search in Open Tabs dialog and validate change in html', async function () {});
    it('Drag and drop link from gifs to item 0,1,i and validate change in chrome.storage.local and html', async function () {
        //open new tabs with www.amazon.com, www.ebay.com, www.etsy.com
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);

        //open context menu
        const background = await driver.findElement(By.id('background'));
        // Trigger the contextmenu event
        await driver.actions().contextClick(background).perform();
        // Wait for the context menu to appear and verify its presence
        //show open tabs popup
        const openGifs = await driver.findElement(By.id('shGifs'));
        await openGifs.click();
        const openGifsPopup = await driver.findElement(By.id('gifs-popup'));
        assert(await openGifsPopup.isDisplayed(), 'Gifs popup should be displayed');
        //drag and drop first a gifsLink from div with id gifs,popup-content to the item id 0,1,i
        const gifsLink = await driver.findElement(By.css('#gifs\\,popup-content a:first-child'));
        const item = await driver.findElement(By.id('0,1,i'));
        await driver.actions().dragAndDrop(gifsLink, item).perform();
        //check in html and chrome.storage.local that the number of 0,1,i,popup-content of item 0,1,i children is 4
        const itemPopup = await driver.findElement(By.id('0,1,i,popup-content'));

        //check that item popup has 4 children

        const children = await itemPopup.findElements(By.xpath('./*'));
        assert.strictEqual(children.length, 9, 'Item popup should have 9 children');
        //check that the item 0,1,i has 9 links in the storage
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                })
            });
        });
        const map = new Map(Object.entries(result));
        const itemAfter = map.get('0,1,i');
        assert.strictEqual(itemAfter.links.length, 9, 'Item 0,1,i should have 9 links in storage');
        //check in chrome.storage.local that the item 0,1,i,4 exists
        const newLink = map.get('0,1,i,4');
        console.assert(newLink, 'Link with id 0,1,i,9 should be present in storage');
        //check no error in console logs
        await checkNoConsoleErrors(driver);
        await driver.quit();
    });
    it('Drag and drop link from bookmarks to item 0,1,i and validate change in chrome.storage.local and html', async function () {
        //open new tabs with www.amazon.com, www.ebay.com, www.etsy.com
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);

        await driver.executeScript(() => {
            chrome.bookmarks.create({
                title: 'eBay',
                url: 'https://www.ebay.com'
            });
        });
        await driver.executeScript(() => {
            chrome.bookmarks.create({
                title: 'amazon',
                url: 'https://www.amazon.com'
            });
        });
        //focus on first opened tab
        const handles = await driver.getAllWindowHandles();
        await driver.switchTo().window(handles[0]);
        //open context menu on the first tab
        const background = await driver.findElement(By.id('background'));
        // Trigger the contextmenu event
        await driver.actions().contextClick(background).perform();
        // Wait for the context menu to appear and verify its presence
        //show open bookmars popup
        const openBookmarks = await driver.findElement(By.id('shBok'));
        await openBookmarks.click();
        await driver.sleep(DEFAULT_SLEEP);

        const openBooksPopup = await driver.findElement(By.id('bookmarks-popup'));
        assert(await openBooksPopup.isDisplayed(), 'Open bookmarks popup should be displayed');
        //drag and drop first a link from div with id open-tabs,popup-content to the item id 0,1,i
        const link = await driver.findElement(By.css('#bookmarks\\,popup-content a:first-child'));
        const item = await driver.findElement(By.id('0,1,i'));
        await driver.actions().dragAndDrop(link, item).perform();
        await driver.sleep(DEFAULT_SLEEP);

        //check in html and chrome.storage.local that the number of 0,1,i,popup-content of item 0,1,i children is 10
        const itemPopup = await driver.findElement(By.id('0,1,i,popup-content'));

        //check that item popup has 10 children

        const children = await itemPopup.findElements(By.xpath('./*'));
        assert.strictEqual(children.length, 10, 'Item popup should have 10 children');
        //check that the item 0,1,i has 10 links in the storage
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const map = new Map(Object.entries(result));
        const itemAfter = map.get('0,1,i');
        assert.strictEqual(itemAfter.links.length, 10, 'Item 0,1,i should have 10 links in storage');
        //check in chrome.storage.local that the item 0,1,i,10 exists
        const newLink = map.get('0,1,i,10');
        console.assert(newLink, 'Link with id 0,1,i,10 should be present in storage');
        //check no error in console logs

        await checkNoConsoleErrors(driver);
        await driver.quit();
    });
    it('Drag and drop link from readingList to item 0,1,i and validate change in chrome.storage.local and html', async function () {
        //open new tabs with www.amazon.com, www.ebay.com, www.etsy.com
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);

        await driver.executeScript(() => {
            chrome.readingList.addEntry({
                title: 'eBay',
                url: 'https://www.ebay.com',
                hasBeenRead: false
            });
        });
        await driver.executeScript(() => {
            chrome.readingList.addEntry({
                title: 'Amazon',
                url: 'https://www.amazon.com',
                hasBeenRead: false
            });
        });
        //focus on first opened tab
        const handles = await driver.getAllWindowHandles();
        await driver.switchTo().window(handles[0]);
        //open context menu on the first tab
        const background = await driver.findElement(By.id('background'));
        // Trigger the contextmenu event
        await driver.actions().contextClick(background).perform();
        // Wait for the context menu to appear and verify its presence
        //show open bookmars popup
        const openReadingList = await driver.findElement(By.id('shRdngLst'));
        await openReadingList.click();
        await driver.sleep(DEFAULT_SLEEP);

        const openBooksPopup = await driver.findElement(By.id('reading-list-popup'));
        assert(await openBooksPopup.isDisplayed(), 'Open reading-list popup should be displayed');
        //drag and drop first a link from div with id open-tabs,popup-content to the item id 0,1,i
        const link = await driver.findElement(By.css('#reading-list\\,popup-content a:first-child'));
        const item = await driver.findElement(By.id('0,1,i'));
        await driver.actions().dragAndDrop(link, item).perform();
        await driver.sleep(DEFAULT_SLEEP);

        //check in html and chrome.storage.local that the number of 0,1,i,popup-content of item 0,1,i children is 4
        const itemPopup = await driver.findElement(By.id('0,1,i,popup-content'));

        //check that item popup has 10 children

        const children = await itemPopup.findElements(By.xpath('./*'));
        assert.strictEqual(children.length, 10, 'Item popup should have 10 children');
        //check that the item 0,1,i has 10 links in the storage
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const map = new Map(Object.entries(result));
        const itemAfter = map.get('0,1,i');
        assert.strictEqual(itemAfter.links.length, 10, 'Item 0,1,i should have 10 links in storage');
        //check in chrome.storage.local that the item 0,1,i,4 exists
        const newLink = map.get('0,1,i,10');
        console.assert(newLink, 'Link with id 0,1,i,10 should be present in storage');
        //check no error in console logs

        await checkNoConsoleErrors(driver);
        await driver.quit();
    });
    it('Remove a link from readingList and validate the change in readingList chrome storage', async function () {
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);

        await driver.executeScript(() => {
            chrome.readingList.addEntry({
                title: 'eBay',
                url: 'https://www.ebay.com',
                hasBeenRead: false
            });
        });
        await driver.executeScript(() => {
            chrome.readingList.addEntry({
                title: 'Amazon',
                url: 'https://www.amazon.com',
                hasBeenRead: false
            });
        });
        //focus on the first opened tab
        const handles = await driver.getAllWindowHandles();
        await driver.switchTo().window(handles[0]);
        //open context menu on the first tab
        const background = await driver.findElement(By.id('background'));
        // Trigger the contextmenu event
        await driver.actions().move({x: 50, y: -150, origin: background}).contextClick().perform();
        // Wait for the context menu to appear and verify its presence
        const openReadingList = await driver.findElement(By.id('shRdngLst'));
        await openReadingList.click();
        await driver.sleep(DEFAULT_SLEEP);
        const openBooksPopup = await driver.findElement(By.id('reading-list-popup'));
        assert(await openBooksPopup.isDisplayed(), 'Open reading-list popup should be displayed');
        //drag and drop first a link from div with id open-tabs,popup-content to the item id 0,1,i
        const link = await driver.findElement(By.css('#reading-list\\,popup-content a:first-child'));
        //show a context menu on the link
        await driver.actions().move({origin: link}).contextClick().perform();
        //click on remove link
        const remLink = await driver.findElement(By.id('remLi'));
        await remLink.click();
        //prompt ok
        await driver.switchTo().alert().accept();
        await driver.sleep(DEFAULT_SLEEP);
        const overlay = await driver.findElement(By.id('overlay'));
        await driver.actions().move({x: 100, y: 200, origin: overlay}).click().perform();
        await driver.sleep(DEFAULT_SLEEP);

        await driver.actions().contextClick(background).perform();
        // Wait for the context menu to appear and verify its presence
        const openReadingListAfter = await driver.findElement(By.id('shRdngLst'));
        await openReadingListAfter.click();
        await driver.sleep(DEFAULT_SLEEP);

        const openReadingListPopupAfter = await driver.findElement(By.id('reading-list,popup-content'));
        assert(await openReadingListPopupAfter.isDisplayed(), 'Open reading-list popup should be displayed');
        await driver.sleep(DEFAULT_SLEEP);
        //check that item popup has 4 children
        const children = await openReadingListPopupAfter.findElements(By.xpath('./*'));
        assert.strictEqual(children.length, 1, 'Item popup should have 4 children');
        //check no error in console logs

        await checkNoConsoleErrors(driver);
        await driver.quit();
    });
    it('Drag and drop link from gifs to station 0,1,s and validate change in chrome.storage.local and html', async function () {});
    it('Drag and drop link from trash to station 0,1,s and validate no change in chrome.storage.local and html', async function () {});
    it('Drag and drop link from trash to dummy 0,1,d and validate no change in chrome.storage.local and html', async function () {});
    it('Show Backgrounds popup from context menu and add new image link to Backgrounds and validate the change in html and chrome.storage.local', async function () {});
    it('Remove all Items and Dummies from the main page and validate no elements in HTML and chrome.storage.local', async function () {
        let driver = await buildDriver()
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        await driver.sleep(DEFAULT_SLEEP);

        //get a list of all divs with class 'pane' and open the context menu on each pane
        const panes = await driver.findElement(By.id('panes'));
        //get a list of all ids with class 'pane'
        const panesIds = await panes.findElements(By.className('pane'));
        //loop through all panesIds and get its id
        for (let i = 0; i < panesIds.length; i++) {
            const paneId = await panesIds[i].getAttribute('id');
            //open context menu on the pane
            const pane = await driver.findElement(By.id(paneId));
            // Trigger the contextmenu event
            await driver.actions().contextClick(pane).perform();
            await driver.sleep(DEFAULT_SLEEP);
            // Wait for the context menu to appear and verify its presence
            // check if paneId contains 'i' or 's' or 'd' and accordingly click on remove item, station or dummy
            if (paneId.includes('i')) {
                const remItem = await driver.findElement(By.id('remItem'));
                await remItem.click();
                await driver.switchTo().alert().accept();
            }
        }
        const dummies = await panes.findElements(By.className('dummyPane'));
        for (let i = 0; i < dummies.length; i++) {
            const dummyId = await dummies[i].getAttribute('id');
            //open context menu on the pane
            const dummy = await driver.findElement(By.id(dummyId));
            // Trigger the contextmenu event
            await driver.actions().contextClick(dummy).perform();
            await driver.sleep(DEFAULT_SLEEP);
            // Wait for the context menu to appear and verify its presence
            const remDummy = await driver.findElement(By.id('remDummy'));
            await remDummy.click();
            await driver.switchTo().alert().accept();
        }
        //check that no div with class 'pane' are present in the html
        const panesAfter = await driver.findElement(By.id('panes'));
        const panesIdsAfter = await panesAfter.findElements(By.className('pane'));
        const dummiesIdsAfter = await panesAfter.findElements(By.className('dummyPane'));
        assert.strictEqual(panesIdsAfter.length, 2, 'There should be no panes in the html');
        assert.strictEqual(dummiesIdsAfter.length, 0, 'There should be no dummies in the html');
        //check that no elements are present in the chrome.storage.local
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const map = new Map(Object.entries(result));
        assert.strictEqual(map.size, 271, 'There should be no elements in the storage');
        //check no error in console logs

        await checkNoConsoleErrors(driver);
        await driver.quit();
    });
    it('Remove all elements from the main page validate all changes in HTML and chrome.storage.local', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);

        await driver.executeScript('window.open("https://www.amazon.com")');
        await driver.executeScript('window.open("https://www.ebay.com")');
        //focus on first opened tab
        const handles = await driver.getAllWindowHandles();
        await driver.switchTo().window(handles[0]);

        await driver.sleep(DEFAULT_SLEEP);
        //get a list of all divs with class 'pane' and open the context menu on each pane
        const panes = await driver.findElement(By.id('panes'));
        //get a list of all ids with class 'pane'
        const panesIds = await panes.findElements(By.className('pane'));
        //loop through all panesIds and get its id
        for (let i = 0; i < panesIds.length; i++) {
            const paneId = await panesIds[i].getAttribute('id');
            //open context menu on the pane
            const pane = await driver.findElement(By.id(paneId));
            // Trigger the contextmenu event
            await driver.actions().contextClick(pane).perform();
            await driver.sleep(DEFAULT_SLEEP);
            // Wait for the context menu to appear and verify its presence
            // check if paneId contains 'i' or 's' or 'd' and accordingly click on remove item, station or dummy
            if (paneId.includes('i')) {
                const remItem = await driver.findElement(By.id('remItem'));
                await remItem.click();
                await driver.switchTo().alert().accept();
            }
        }
        const dummies = await panes.findElements(By.className('dummyPane'));
        for (let i = 0; i < dummies.length; i++) {
            const dummyId = await dummies[i].getAttribute('id');
            //open context menu on the pane
            const dummy = await driver.findElement(By.id(dummyId));
            // Trigger the contextmenu event
            await driver.actions().contextClick(dummy).perform();
            await driver.sleep(DEFAULT_SLEEP);
            // Wait for the context menu to appear and verify its presence
            const remDummy = await driver.findElement(By.id('remDummy'));
            await remDummy.click();
            await driver.switchTo().alert().accept();
        }
        //check that no div with class 'pane' are present in the html
        const panesAfter = await driver.findElement(By.id('panes'));
        const panesIdsAfter = await panesAfter.findElements(By.className('pane'));
        const dummiesIdsAfter = await panesAfter.findElements(By.className('dummyPane'));
        assert.strictEqual(panesIdsAfter.length, 2, 'There should be no panes in the html');
        assert.strictEqual(dummiesIdsAfter.length, 0, 'There should be no dummies in the html');
        //check that no elements are present in the chrome.storage.local
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const map = new Map(Object.entries(result));
        assert.strictEqual(map.size, 271, 'There should be no elements in the storage');
        //create tree of stations,items and dummies
        //create item
        const background = await driver.findElement(By.id('background'));
        //place mouse 800 px left and 200 px top
        const org = await driver.findElement(By.id('0,2,s'));
        const actions = driver.actions({async: true});
        await actions.move({x: 100, y: 500,origin: org}).perform();
        await driver.sleep(DEFAULT_SLEEP);

        // Trigger the contextmenu event
        await driver.actions().contextClick(background).perform();
        // Wait for the context menu to appear and verify its presence
        //create item
        const adItemBtn = await driver.findElement(By.id('adItBtn'));
        const adItemInp = await driver.findElement(By.id('adItInp'));
        await adItemInp.clear();
        await adItemInp.sendKeys('New Item1');
        await adItemBtn.click();
        await driver.sleep(DEFAULT_SLEEP);
        const itemElement = await driver.findElement(By.id('0,0,i,title'));
        const itemTitle = await itemElement.getAttribute('innerHTML');
        assert.strictEqual(itemTitle, 'New Item1', 'Item title should be New Item1');
        //create station
        //place mouse 800 px left and 400 px top
        await actions.move({x: 500, y: 100}).perform();
        await driver.sleep(DEFAULT_SLEEP);
        // Trigger the contextmenu event
        await driver.actions().contextClick(background).perform();
        // Wait for the context menu to appear and verify its presence
        //create station
        const adStationBtn = await driver.findElement(By.id('adStBtn'));
        const adStationInp = await driver.findElement(By.id('adStInp'));
        await adStationInp.clear();
        await adStationInp.sendKeys('New Station1');
        await adStationBtn.click();
        const stationElement = await driver.findElement(By.id('0,3,s,title'));
        const stationTitle = await stationElement.getAttribute('innerHTML');
        assert.strictEqual(stationTitle, 'New Station1', 'Station title should be New Station1');
        //create dummy
        //place mouse 800 px left and 600 px top
        await actions.move({x: 300, y: 150}).perform();
        await driver.sleep(DEFAULT_SLEEP);

        // Trigger the contextmenu event
        await driver.actions().contextClick(background).perform();
        //create dummy
        const adDummyBtn = await driver.findElement(By.id('adDumBtn'));
        const adDummyInp = await driver.findElement(By.id('adDumInp'));
        await adDummyInp.clear();
        await adDummyInp.sendKeys('New Dummy1');
        await adDummyBtn.click();
        const dummyElement = await driver.findElement(By.id('0,0,d,title'));
        const dummyTitle = await dummyElement.getAttribute('innerHTML');
        assert.strictEqual(dummyTitle, 'New Dummy1', 'Dummy title should be New Dummy1');
        //check that all elements are present in the chrome.storage.local
        //check no error in console logs
        await checkNoConsoleErrors(driver);
        await driver.quit();
    });
    it('Create different objects in different places of stations,items and dummies with existing objects. validate all changes in HTML and chrome.storage.local', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);


        await driver.sleep(DEFAULT_SLEEP);
        //get a list of all divs with class 'pane' and open the context menu on each pane

        //create item
        const background = await driver.findElement(By.id('background'));
        await driver.actions().move({x: 200, y: 200, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);

        // Wait for the context menu to appear and verify its presence
        //create item
        const adItemBtn = await driver.findElement(By.id('adItBtn'));
        const adItemInp = await driver.findElement(By.id('adItInp'));
        await adItemInp.clear();
        await adItemInp.sendKeys('New Item1');
        await adItemBtn.click();
        const itemElement = await driver.findElement(By.id('0,15,i,title'));
        const itemTitle = await itemElement.getAttribute('innerHTML');
        assert.strictEqual(itemTitle, 'New Item1', 'Item title should be New Item1');
        //create station
        await driver.actions().move({x: 50, y: 50, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        // Trigger the contextmenu event
        //create station
        const adStationBtn = await driver.findElement(By.id('adStBtn'));
        const adStationInp = await driver.findElement(By.id('adStInp'));
        await adStationInp.clear();
        await adStationInp.sendKeys('New Station1');
        await adStationBtn.click();
        const stationElement = await driver.findElement(By.id('0,3,s,title'));
        const stationTitle = await stationElement.getAttribute('innerHTML');
        assert.strictEqual(stationTitle, 'New Station1', 'Station title should be New Station1');
        //create station2
        await driver.actions().move({x: -10, y: -160, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //create station2
        const adStationBtn2 = await driver.findElement(By.id('adStBtn'));
        const adStationInp2 = await driver.findElement(By.id('adStInp'));
        await adStationInp2.clear();
        await adStationInp2.sendKeys('New Station2');
        await adStationBtn2.click();
        const stationElement2 = await driver.findElement(By.id('0,4,s,title'));
        const stationTitle2 = await stationElement2.getAttribute('innerHTML');
        assert.strictEqual(stationTitle2, 'New Station2', 'Station title should be New Station2');
        //change station2 icon
        const station2 = await driver.findElement(By.id('0,4,s'));
        //open context from station2
        await driver.actions().contextClick(station2).perform();
        //click on the change icon
        const chIcon = await driver.findElement(By.id('chgObjIc'));
        await chIcon.click();
        //show GIFs popup
        const gif1 = await driver.findElement(By.css('#gifs\\,popup-content img:first-child'));
        //get gif1 src
        const gif1Src = await gif1.getAttribute('src');
        await gif1.click();
        await driver.sleep(DEFAULT_SLEEP);
        const itemLocation = await driver.findElement(By.id('0,15,i')).getRect();
        const stationLocation = await driver.findElement(By.id('0,3,s')).getRect();

        //Click on station2
        station2.click();
        await driver.sleep(DEFAULT_SLEEP);
        //add item
        await driver.actions().move({x: -200, y: -200, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //create item
        const adItemBtn3 = await driver.findElement(By.id('adItBtn'));
        const adItemInp3 = await driver.findElement(By.id('adItInp'));
        await adItemInp3.clear();
        await adItemInp3.sendKeys('New Item3');
        await adItemBtn3.click();
        const itemElement3 = await driver.findElement(By.id('8,0,i,title'));
        const itemTitle3 = await itemElement3.getAttribute('innerHTML');
        assert.strictEqual(itemTitle3, 'New Item3', 'Item title should be New Item3');
        //Assign new GIF for the item from GIFs popup
        //open context menu
        const nestedBackground4 = await driver.findElement(By.id('background'));
        // Trigger the contextmenu event
        await driver.actions().contextClick(nestedBackground4).perform();
        await driver.actions().move({x: -200, y: 0, origin: nestedBackground4}).contextClick().perform();
        //show GIFs popup
        const showGifs4 = await driver.findElement(By.id('shGifs'));
        await showGifs4.click();
        const gifsPopup4 = await driver.findElement(By.id('gifs-popup'));
        assert(await gifsPopup4.isDisplayed(), 'GIFs popup should be displayed');
        //drag and drop first a GIF from div with id gifs,popup-content to the item id 8,0,i
        const gif4 = await driver.findElement(By.css('#gifs\\,popup-content img:first-child'));
        const gifSrc4 = await gif4.getAttribute('src');
        const item8 = await driver.findElement(By.id('8,0,i'));
        await driver.actions().dragAndDrop(gif4, item8).perform();
        //check in HTML that the number of 8,0,i,img is cat
        const itemImg4 = await driver.findElement(By.id('8,0,i,img'));
        const imgSrc4 = await itemImg4.getAttribute('src');
        assert.strictEqual(imgSrc4, gifSrc4, 'Item 8,0,i should have cat GIF');
        //Drag and drop item 8,0,i
        await driver.actions().dragAndDrop(item8, {x: -50, y: -50}).perform();
        await driver.sleep(DEFAULT_SLEEP);
        //create dummy
        await driver.actions().move({x: 0, y: 0, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        const adDummyBtn5 = await driver.findElement(By.id('adDumBtn'));
        const adDummyInp5 = await driver.findElement(By.id('adDumInp'));
        await adDummyInp5.clear();
        await adDummyInp5.sendKeys('New Dummy5');
        await adDummyBtn5.click();
        const dummyElement5 = await driver.findElement(By.id('8,0,d,title'));
        const dummyTitle5 = await dummyElement5.getAttribute('innerHTML');
        assert.strictEqual(dummyTitle5, 'New Dummy5', 'Dummy title should be New Dummy4');

        //Click on Back button
        const nestedBackBtn = await driver.findElement(By.id('back-btn-div'));
        nestedBackBtn.click();
        await driver.sleep(DEFAULT_SLEEP);
        //add station
        await driver.actions().move({x: -250, y: -250, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //create station
        const adStationBtn3 = await driver.findElement(By.id('adStBtn'));
        const adStationInp3 = await driver.findElement(By.id('adStInp'));
        await adStationInp3.clear();
        await adStationInp3.sendKeys('New Station3');
        await adStationBtn3.click();
        await driver.sleep(DEFAULT_SLEEP);
        const stationElement3 = await driver.findElement(By.id('0,5,s,title'));
        const stationTitle3 = await stationElement3.getAttribute('innerHTML');
        assert.strictEqual(stationTitle3, 'New Station3', 'Station title should be New Station3');
        //click on station 0,5,s
        const newStation3 = await driver.findElement(By.id('0,5,s'));
        newStation3.click();
        await driver.sleep(DEFAULT_SLEEP);
        //change background
        //open context menu
        const background3 = await driver.findElement(By.id('background'));
        // Trigger the contextmenu event
        await driver.actions().contextClick(background3).perform();
        //show Backgrounds popup
        const showBgs3 = await driver.findElement(By.id('shBckg'));
        await showBgs3.click();
        const bgsPopup3 = await driver.findElement(By.id('backgrounds-popup'));
        assert(await bgsPopup3.isDisplayed(), 'Backgrounds popup should be displayed');
        //drag and drop first a background from div with id bgs,popup-content to the background
        const bg3 = await driver.findElement(By.css('#backgrounds\\,popup-content img:first-child'));
        const bgSrc3 = await bg3.getAttribute('src').then(src => decodeURIComponent(src));
        await driver.actions().dragAndDrop(bg3, {x: -100, y: 200, origin: background3}).perform();
        await driver.sleep(DEFAULT_SLEEP);
        await driver.actions().move({x: 150, y: 150, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //Click on Add item
        const adItemBtn4 = await driver.findElement(By.id('adItBtn'));
        const adItemInp4 = await driver.findElement(By.id('adItInp'));
        await adItemInp4.clear();
        await adItemInp4.sendKeys('New Item4');
        await adItemBtn4.click();
        const itemElement4 = await driver.findElement(By.id('9,0,i,title'));
        const itemTitle4 = await itemElement4.getAttribute('innerHTML');
        assert.strictEqual(itemTitle4, 'New Item4', 'Item title should be New Item4');
        await driver.actions().move({x: -50, y: -350, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);

        //click on add dummy
        const adDummyBtn4 = await driver.findElement(By.id('adDumBtn'));
        const adDummyInp4 = await driver.findElement(By.id('adDumInp'));
        await adDummyInp4.clear();
        await adDummyInp4.sendKeys('New Dummy4');
        await adDummyBtn4.click();
        const dummyElement4 = await driver.findElement(By.id('9,0,d,title'));
        const dummyTitle4 = await dummyElement4.getAttribute('innerHTML');
        assert.strictEqual(dummyTitle4, 'New Dummy4', 'Dummy title should be New Dummy4');

        //create dummy
        await driver.actions().move({x: -200, y: -200, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);

        //create dummy
        const adDummyBtn = await driver.findElement(By.id('adDumBtn'));
        const adDummyInp = await driver.findElement(By.id('adDumInp'));
        await adDummyInp.clear();
        await adDummyInp.sendKeys('New Dummy1');
        await adDummyBtn.click();
        const dummyElement = await driver.findElement(By.id('9,1,d,title'));
        const dummyTitle = await dummyElement.getAttribute('innerHTML');
        assert.strictEqual(dummyTitle, 'New Dummy1', 'Dummy title should be New Dummy1');
        //Click on Back button
        const nestedBackBtn3 = await driver.findElement(By.id('back-btn-div'));
        nestedBackBtn3.click();
        await driver.sleep(DEFAULT_SLEEP);

        //Click on station 0,3,s
        const newStation = await driver.findElement(By.id('0,3,s'));
        newStation.click();
        await driver.sleep(DEFAULT_SLEEP);
        //create item
        await driver.actions().move({x: 200, y: 200, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //create item
        const adItemBtn1 = await driver.findElement(By.id('adItBtn'));
        const adItemInp1 = await driver.findElement(By.id('adItInp'));
        await adItemInp1.clear();
        await adItemInp1.sendKeys('New Item2');
        await adItemBtn1.click();
        const itemElement1 = await driver.findElement(By.id('7,0,i,title'));
        const itemTitle1 = await itemElement1.getAttribute('innerHTML');
        assert.strictEqual(itemTitle1, 'New Item2', 'Item title should be New Item2');
        //Assign new GIF for the item from GIFs popup
        //open context menu
        const nestedBackground = await driver.findElement(By.id('background'));
        // Trigger the contextmenu event
        await driver.actions().contextClick(nestedBackground).perform();
        await driver.actions().move({x: -200, y: 0, origin: nestedBackground}).contextClick().perform();

        //show GIFs popup
        const showGifs = await driver.findElement(By.id('shGifs'));
        await showGifs.click();
        const gifsPopup = await driver.findElement(By.id('gifs-popup'));
        assert(await gifsPopup.isDisplayed(), 'GIFs popup should be displayed');
        //drag and drop first a GIF from div with id gifs,popup-content to the item id 7,0,i
        const gif = await driver.findElement(By.css('#gifs\\,popup-content img:first-child'));
        const gifSrc = await gif.getAttribute('src');
        const item7 = await driver.findElement(By.id('7,0,i'));
        await driver.actions().dragAndDrop(gif, item7).perform();
        //check in html that the number of 7,0,i,img is cat
        const itemImg = await driver.findElement(By.id('7,0,i,img'));
        const imgSrc = await itemImg.getAttribute('src');
        assert.strictEqual(imgSrc, gifSrc, 'Item 7,0,i should have cat GIF');
        //Drag and drop item 7,0,i
        await driver.actions().dragAndDrop(item7, {x: 50, y: 50}).perform();
        //create station
        await driver.actions().move({x: 50, y: 50, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //create station
        const adStationBtn1 = await driver.findElement(By.id('adStBtn'));
        const adStationInp1 = await driver.findElement(By.id('adStInp'));
        await adStationInp1.clear();
        await adStationInp1.sendKeys('New Station2');
        await adStationBtn1.click();
        const stationElement1 = await driver.findElement(By.id('7,0,s,title'));
        const stationTitle1 = await stationElement1.getAttribute('innerHTML');
        assert.strictEqual(stationTitle1, 'New Station2', 'Station title should be New Station2');
        //create dummy
        await driver.actions().move({x: -200, y: -200, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //create dummy
        const adDummyBtn1 = await driver.findElement(By.id('adDumBtn'));
        const adDummyInp1 = await driver.findElement(By.id('adDumInp'));
        await adDummyInp1.clear();
        await adDummyInp1.sendKeys('New Dummy2');
        await adDummyBtn1.click();
        const dummyElement1 = await driver.findElement(By.id('7,0,d,title'));
        const dummyTitle1 = await dummyElement1.getAttribute('innerHTML');
        assert.strictEqual(dummyTitle1, 'New Dummy2', 'Dummy title should be New Dummy2');


        //check the elements in HTML present with the correct positions
        await driver.findElement(By.id('7,0,i')).getRect();
        const stationLocation1 = await driver.findElement(By.id('7,0,s')).getRect();
        const dummyLocation1 = await driver.findElement(By.id('7,0,d')).getRect();
        //Click on station 7,0,s
        const newStation1 = await driver.findElement(By.id('7,0,s'));
        newStation1.click();
        await driver.sleep(DEFAULT_SLEEP);

        //Click on Back button
        const backBtn = await driver.findElement(By.id('back-btn-div'));
        backBtn.click();
        await driver.sleep(DEFAULT_SLEEP);
        //validate that item 7,0,i is present in HTML
        const itemElement2 = await driver.findElement(By.id('7,0,i,title'));
        const itemTitle2 = await itemElement2.getAttribute('innerHTML');
        assert.strictEqual(itemTitle2, 'New Item2', 'Item title should be New Item2');


        //storage validations
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const map = new Map(Object.entries(result));
        //check that all elements are present in the chrome.storage.local
        const item = map.get('0,15,i');
        console.assert(item, 'Item with id 0,15,i should be present in storage');
        const station = map.get('0,3,s');
        console.assert(station, 'Station with id 0,3,s should be present in storage');
        const dummy = map.get('0,5,d');
        console.assert(dummy, 'Dummy with id 0,5,d should be present in storage');
        //check the elements in HTML present with the correct positions
        assert.strictEqual(itemLocation.x+"px", item.left, 'Item should be placed at 200px left');
        assert.strictEqual(itemLocation.y+"px", item.top, 'Item should be placed at 200px top');
        assert.strictEqual(stationLocation.x+"px", station.left, 'Station should be placed at 50px left');
        assert.strictEqual(stationLocation.y+"px", station.top, 'Station should be placed at 50px top');

        //validate that all elements are present in the chrome.storage.local
        const result1 = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const map1 = new Map(Object.entries(result1));
        //check that all elements are present in the chrome.storage.local
        const station1 = map1.get('7,0,s');
        console.assert(station1, 'Station with id 0,4,s should be present in storage');
        console.assert(station1.parent,0, 'Station 7,0,s should have parent 0');
        const dummy1 = map1.get('7,0,d');
        console.assert(dummy1, 'Dummy with id 0,6,d should be present in storage');
        assert.strictEqual(stationLocation1.x+"px", station1.left, 'Station should be placed at 50px left');
        assert.strictEqual(stationLocation1.y+"px", station1.top, 'Station should be placed at 50px top');
        assert.strictEqual(dummyLocation1.x+"px", dummy1.left, 'Dummy should be placed at 0px left');
        assert.strictEqual(dummyLocation1.y+"px", dummy1.top, 'Dummy should be placed at 0px top');

        //validate that item 7 in storage contains correct values
        const root = map1.get('7');
        console.assert(root, 'Root with id 7 should be present in storage');
        assert.strictEqual(root.items.length, 1, 'Root 7 should have 1 item');
        assert.strictEqual(root.stations.length, 1, 'Root 7 should have 1 station');
        assert.strictEqual(root.dummies.length, 1, 'Root 7 should have 1 dummy');

        //validate station2 icon change in storage
        const result3 = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        //validate background change in chrome.storage.local
        const result4 = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const map4 = new Map(Object.entries(result4));
        const background4 = map4.get('9');
        assert.strictEqual(background4.background, bgSrc3, 'Background should be changed in storage');
        const map3 = new Map(Object.entries(result3));
        const stationAfter3 = map3.get('0,4,s');
        assert.strictEqual(stationAfter3.icon, gif1Src, 'Station 0,4,s should have new icon');

        await checkNoConsoleErrors(driver);
        await driver.quit();
    });
    it('Create different objects in different places of stations,items and dummies from fresh start. validate all changes in HTML and chrome.storage.local', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver);
        await driver.sleep(DEFAULT_SLEEP);
        //get a list of all divs with class 'pane' and open the context menu on each pane

        //create item
        const background = await driver.findElement(By.id('background'));
        await driver.actions().move({x: 200, y: 200, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);

        // Wait for the context menu to appear and verify its presence
        //create item
        const adItemBtn = await driver.findElement(By.id('adItBtn'));
        const adItemInp = await driver.findElement(By.id('adItInp'));
        await adItemInp.clear();
        await adItemInp.sendKeys('New Item1');
        await adItemBtn.click();
        const itemElement = await driver.findElement(By.id('0,0,i,title'));
        const itemTitle = await itemElement.getAttribute('innerHTML');
        assert.strictEqual(itemTitle, 'New Item1', 'Item title should be New Item1');
        //create station
        await driver.actions().move({x: 50, y: 50, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        // Trigger the contextmenu event
        //create station
        const adStationBtn = await driver.findElement(By.id('adStBtn'));
        const adStationInp = await driver.findElement(By.id('adStInp'));
        await adStationInp.clear();
        await adStationInp.sendKeys('New Station1');
        await adStationBtn.click();
        const stationElement = await driver.findElement(By.id('0,0,s,title'));
        const stationTitle = await stationElement.getAttribute('innerHTML');
        assert.strictEqual(stationTitle, 'New Station1', 'Station title should be New Station1');
        //create station2
        await driver.actions().move({x: -10, y: -160, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //create station2
        const adStationBtn2 = await driver.findElement(By.id('adStBtn'));
        const adStationInp2 = await driver.findElement(By.id('adStInp'));
        await adStationInp2.clear();
        await adStationInp2.sendKeys('New Station2');
        await adStationBtn2.click();
        const stationElement2 = await driver.findElement(By.id('0,1,s,title'));
        const stationTitle2 = await stationElement2.getAttribute('innerHTML');
        assert.strictEqual(stationTitle2, 'New Station2', 'Station title should be New Station2');
        //change station2 icon
        const station2 = await driver.findElement(By.id('0,1,s'));
        //open context from station2
        await driver.actions().contextClick(station2).perform();
        //click on the change icon
        const chIcon = await driver.findElement(By.id('chgObjIc'));
        await chIcon.click();
        //show GIFs popup
        const gif1 = await driver.findElement(By.css('#gifs\\,popup-content img:first-child'));
        //get gif1 src
        const gif1Src = await gif1.getAttribute('src');
        await gif1.click();
        await driver.sleep(DEFAULT_SLEEP);
        const itemLocation = await driver.findElement(By.id('0,0,i')).getRect();
        const stationLocation = await driver.findElement(By.id('0,0,s')).getRect();

        //Click on station2
        station2.click();
        await driver.sleep(DEFAULT_SLEEP);
        //add item
        await driver.actions().move({x: -200, y: -200, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //create item
        const adItemBtn3 = await driver.findElement(By.id('adItBtn'));
        const adItemInp3 = await driver.findElement(By.id('adItInp'));
        await adItemInp3.clear();
        await adItemInp3.sendKeys('New Item3');
        await adItemBtn3.click();
        const itemElement3 = await driver.findElement(By.id('2,0,i,title'));
        const itemTitle3 = await itemElement3.getAttribute('innerHTML');
        assert.strictEqual(itemTitle3, 'New Item3', 'Item title should be New Item3');
        //Assign a new GIF for the item from GIFs popup
        //an open context menu
        const nestedBackground4 = await driver.findElement(By.id('background'));
        // Trigger the contextmenu event
        await driver.actions().contextClick(nestedBackground4).perform();
        await driver.actions().move({x: -200, y: 0, origin: nestedBackground4}).contextClick().perform();
        //show GIFs popup
        const showGifs4 = await driver.findElement(By.id('shGifs'));
        await showGifs4.click();
        await driver.sleep(DEFAULT_SLEEP);
        const gifsPopup4 = await driver.findElement(By.id('gifs-popup'));
        assert(await gifsPopup4.isDisplayed(), 'GIFs popup should be displayed');
        //drag and drop first a GIF from the div with id gifs,popup-content to the item id 2,0,i
        const gif4 = await driver.findElement(By.css('#gifs\\,popup-content img:first-child'));
        const gifSrc4 = await gif4.getAttribute('src');
        const item1 = await driver.findElement(By.id('2,0,i'));
        await driver.actions().dragAndDrop(gif4, item1).perform();
        await driver.sleep(DEFAULT_SLEEP);
        //check in HTML that the number of 2,0,i,img is a cat
        const itemImg4 = await driver.findElement(By.id('2,0,i,img'));
        const imgSrc4 = await itemImg4.getAttribute('src');
        assert.strictEqual(imgSrc4, gifSrc4, 'Item 2,0,i should have cat GIF');
        //Drag and drop item 8,0,i
        await driver.actions().dragAndDrop(item1, {x: -50, y: -50}).perform();
        await driver.sleep(DEFAULT_SLEEP);
        //create dummy
        await driver.actions().move({x: 0, y: 0, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        const adDummyBtn5 = await driver.findElement(By.id('adDumBtn'));
        const adDummyInp5 = await driver.findElement(By.id('adDumInp'));
        await adDummyInp5.clear();
        await adDummyInp5.sendKeys('New Dummy5');
        await adDummyBtn5.click();
        const dummyElement5 = await driver.findElement(By.id('2,0,d,title'));
        const dummyTitle5 = await dummyElement5.getAttribute('innerHTML');
        assert.strictEqual(dummyTitle5, 'New Dummy5', 'Dummy title should be New Dummy4');

        //Click on the Back button
        const nestedBackBtn = await driver.findElement(By.id('back-btn-div'));
        nestedBackBtn.click();
        await driver.sleep(DEFAULT_SLEEP);
        //add station
        await driver.actions().move({x: -250, y: -250, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //create station
        const adStationBtn3 = await driver.findElement(By.id('adStBtn'));
        const adStationInp3 = await driver.findElement(By.id('adStInp'));
        await adStationInp3.clear();
        await adStationInp3.sendKeys('New Station3');
        await adStationBtn3.click();
        await driver.sleep(DEFAULT_SLEEP);
        const stationElement3 = await driver.findElement(By.id('0,2,s,title'));
        const stationTitle3 = await stationElement3.getAttribute('innerHTML');
        assert.strictEqual(stationTitle3, 'New Station3', 'Station title should be New Station3');
        //click on station 0,2,s
        const newStation3 = await driver.findElement(By.id('0,2,s'));
        newStation3.click();
        await driver.sleep(DEFAULT_SLEEP);
        //change background
        //open context menu
        const background3 = await driver.findElement(By.id('background'));
        // Trigger the contextmenu event
        await driver.actions().contextClick(background3).perform();
        //show Backgrounds popup
        const showBgs3 = await driver.findElement(By.id('shBckg'));
        await showBgs3.click();
        const bgsPopup3 = await driver.findElement(By.id('backgrounds-popup'));
        assert(await bgsPopup3.isDisplayed(), 'Backgrounds popup should be displayed');
        //drag and drop first a background from div with id bgs,popup-content to the background
        const bg3 = await driver.findElement(By.css('#backgrounds\\,popup-content img:first-child'));
        const bgSrc3 = await bg3.getAttribute('src').then(src => decodeURIComponent(src));
        await driver.actions().dragAndDrop(bg3, {x: -100, y: 200, origin: background3}).perform();
        await driver.sleep(DEFAULT_SLEEP);
        await driver.actions().move({x: 150, y: 150, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //Click on Add item
        const adItemBtn4 = await driver.findElement(By.id('adItBtn'));
        const adItemInp4 = await driver.findElement(By.id('adItInp'));
        await adItemInp4.clear();
        await adItemInp4.sendKeys('New Item4');
        await adItemBtn4.click();
        const itemElement4 = await driver.findElement(By.id('3,0,i,title'));
        const itemTitle4 = await itemElement4.getAttribute('innerHTML');
        assert.strictEqual(itemTitle4, 'New Item4', 'Item title should be New Item4');
        await driver.actions().move({x: -50, y: -350, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);

        //click on add dummy
        const adDummyBtn4 = await driver.findElement(By.id('adDumBtn'));
        const adDummyInp4 = await driver.findElement(By.id('adDumInp'));
        await adDummyInp4.clear();
        await adDummyInp4.sendKeys('New Dummy4');
        await adDummyBtn4.click();
        const dummyElement4 = await driver.findElement(By.id('3,0,d,title'));
        const dummyTitle4 = await dummyElement4.getAttribute('innerHTML');
        assert.strictEqual(dummyTitle4, 'New Dummy4', 'Dummy title should be New Dummy4');

        //create dummy
        await driver.actions().move({x: -200, y: -200, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);

        //create dummy
        const adDummyBtn = await driver.findElement(By.id('adDumBtn'));
        const adDummyInp = await driver.findElement(By.id('adDumInp'));
        await adDummyInp.clear();
        await adDummyInp.sendKeys('New Dummy1');
        await adDummyBtn.click();
        const dummyElement = await driver.findElement(By.id('3,1,d,title'));
        const dummyTitle = await dummyElement.getAttribute('innerHTML');
        assert.strictEqual(dummyTitle, 'New Dummy1', 'Dummy title should be New Dummy1');
        //Click on Back button
        const nestedBackBtn3 = await driver.findElement(By.id('back-btn-div'));
        nestedBackBtn3.click();
        await driver.sleep(DEFAULT_SLEEP);

        //Click on station 0,0,s
        const newStation = await driver.findElement(By.id('0,0,s'));
        newStation.click();
        await driver.sleep(DEFAULT_SLEEP);
        //create item
        await driver.actions().move({x: 100, y: 250, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //create item
        const adItemBtn1 = await driver.findElement(By.id('adItBtn'));
        const adItemInp1 = await driver.findElement(By.id('adItInp'));
        await adItemInp1.clear();
        await adItemInp1.sendKeys('New Item2');
        await adItemBtn1.click();
        const itemElement1 = await driver.findElement(By.id('1,0,i,title'));
        const itemTitle1 = await itemElement1.getAttribute('innerHTML');
        assert.strictEqual(itemTitle1, 'New Item2', 'Item title should be New Item2');
        //Assign new GIF for the item from GIFs popup
        //open context menu
        const nestedBackground = await driver.findElement(By.id('background'));
        // Trigger the contextmenu event
        await driver.actions().contextClick(nestedBackground).perform();
        await driver.actions().move({x: -200, y: 0, origin: nestedBackground}).contextClick().perform();

        //show GIFs popup
        const showGifs = await driver.findElement(By.id('shGifs'));
        await showGifs.click();
        const gifsPopup = await driver.findElement(By.id('gifs-popup'));
        assert(await gifsPopup.isDisplayed(), 'GIFs popup should be displayed');
        //drag and drop first a GIF from div with id gifs,popup-content to the item id 0,1,i
        const gif = await driver.findElement(By.css('#gifs\\,popup-content img:first-child'));
        const gifSrc = await gif.getAttribute('src');
        const item7 = await driver.findElement(By.id('1,0,i'));
        await driver.actions().dragAndDrop(gif, item7).perform();
        await driver.sleep(DEFAULT_SLEEP);
        //check in html that the number of 0,1,i,img is cat
        const itemImg = await driver.findElement(By.id('1,0,i,img'));
        const imgSrc = await itemImg.getAttribute('src');
        assert.strictEqual(imgSrc, gifSrc, 'Item 1,0,i should have cat GIF');
        //Drag and drop item 0,1,i
        await driver.actions().dragAndDrop(item7, {x: 50, y: 50}).perform();
        //create station
        await driver.actions().move({x: 50, y: 50, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //create station
        const adStationBtn1 = await driver.findElement(By.id('adStBtn'));
        const adStationInp1 = await driver.findElement(By.id('adStInp'));
        await adStationInp1.clear();
        await adStationInp1.sendKeys('New Station2');
        await adStationBtn1.click();
        const stationElement1 = await driver.findElement(By.id('1,0,s,title'));
        const stationTitle1 = await stationElement1.getAttribute('innerHTML');
        assert.strictEqual(stationTitle1, 'New Station2', 'Station title should be New Station2');
        //create dummy
        await driver.actions().move({x: -200, y: -200, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //create dummy
        const adDummyBtn1 = await driver.findElement(By.id('adDumBtn'));
        const adDummyInp1 = await driver.findElement(By.id('adDumInp'));
        await adDummyInp1.clear();
        await adDummyInp1.sendKeys('New Dummy2');
        await adDummyBtn1.click();
        const dummyElement1 = await driver.findElement(By.id('1,0,d,title'));
        const dummyTitle1 = await dummyElement1.getAttribute('innerHTML');
        assert.strictEqual(dummyTitle1, 'New Dummy2', 'Dummy title should be New Dummy2');


        //check the elements in HTML present with the correct positions
        await driver.findElement(By.id('1,0,i')).getRect();
        const stationLocation1 = await driver.findElement(By.id('1,0,s')).getRect();
        const dummyLocation1 = await driver.findElement(By.id('1,0,d')).getRect();
        //Click on station 7,0,s
        const newStation1 = await driver.findElement(By.id('1,0,s'));
        newStation1.click();
        await driver.sleep(DEFAULT_SLEEP);

        //Click on the Back button
        const backBtn = await driver.findElement(By.id('back-btn-div'));
        backBtn.click();
        await driver.sleep(DEFAULT_SLEEP);
        //validate that item 1,0,i is present in HTML
        const itemElement2 = await driver.findElement(By.id('1,0,i,title'));
        const itemTitle2 = await itemElement2.getAttribute('innerHTML');
        assert.strictEqual(itemTitle2, 'New Item2', 'Item title should be New Item2');


        //storage validations
        const result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const map = new Map(Object.entries(result));
        //check that all elements are present in the chrome.storage.local
        const item = map.get('0,0,i');
        console.assert(item, 'Item with id 0,0,i should be present in storage');
        const station = map.get('0,0,s');
        console.assert(station, 'Station with id 0,0,s should be present in storage');
        const dummy = map.get('1,0,d');
        console.assert(dummy, 'Dummy with id 1,0,d should be present in storage');
        //check the elements in HTML present with the correct positions
        assert.strictEqual(itemLocation.x+"px", item.left, 'Item should be placed at 200px left');
        assert.strictEqual(itemLocation.y+"px", item.top, 'Item should be placed at 200px top');
        assert.strictEqual(stationLocation.x+"px", station.left, 'Station should be placed at 50px left');
        assert.strictEqual(stationLocation.y+"px", station.top, 'Station should be placed at 50px top');

        //validate that all elements are present in the chrome.storage.local
        const result1 = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const map1 = new Map(Object.entries(result1));
        //check that all elements are present in the chrome.storage.local
        const station1 = map1.get('1,0,s');
        console.assert(station1, 'Station with id 0,1,s should be present in storage');
        assert.strictEqual(station1.parent,undefined, 'Station 0,1,s should have no parent');
        const dummy1 = map1.get('1,0,d');
        console.assert(dummy1, 'Dummy with id 0,0,d should be present in storage');
        assert.strictEqual(stationLocation1.x+"px", station1.left, 'Station should be placed at 50px left');
        assert.strictEqual(stationLocation1.y+"px", station1.top, 'Station should be placed at 50px top');
        assert.strictEqual(dummyLocation1.x+"px", dummy1.left, 'Dummy should be placed at 0px left');
        assert.strictEqual(dummyLocation1.y+"px", dummy1.top, 'Dummy should be placed at 0px top');

        //validate that item 7 in storage contains correct values
        const root = map1.get('1');
        console.assert(root, 'Root with id 7 should be present in storage');
        assert.strictEqual(root.items.length, 1, 'Root 7 should have 1 item');
        assert.strictEqual(root.stations.length, 1, 'Root 7 should have 1 station');
        assert.strictEqual(root.dummies.length, 1, 'Root 7 should have 1 dummy');

        //validate station2 icon change in storage
        const result3 = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        //validate background change in chrome.storage.local
        const result4 = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        const map4 = new Map(Object.entries(result4));
        const background4 = map4.get('3');
        assert.strictEqual(background4.background, bgSrc3, 'Background should be changed in storage');
        const map3 = new Map(Object.entries(result3));
        const stationAfter3 = map3.get('0,1,s');
        assert.strictEqual(stationAfter3.icon, gif1Src, 'Station 0,1,s should have new icon of cat');

        await checkNoConsoleErrors(driver);
        await driver.quit();
    });
    it('Add and browse different websites to bookmarks,readinglist from fresh start. validate all changes in different dialogs', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver);
        await driver.sleep(DEFAULT_SLEEP);
        //get a list of all divs with class 'pane' and open the context menu on each pane
        await driver.executeScript('window.open("https://www.amazon.com")');
        await driver.executeScript('window.open("https://www.ebay.com")');
        await driver.executeScript('window.open("https://www.gmail.com/")');
        await driver.executeScript('window.open("https://www.chatgpt.com/")');
        await driver.executeScript('window.open("https://www.google.com/search?q=tesla+model+s+model+x")');
        await driver.executeScript('window.open("https://www.google.com/search?q=tesla+model+s+model+x")');
        await driver.executeScript('window.open("https://www.youtube.com/results?search_query=techno+remix")');
        await driver.executeScript('window.open("https://chromewebstore.google.com/category/extensions")');
        //add 3 links to bookmarks
        await driver.executeScript(() => {
            chrome.bookmarks.create({title: 'Amazon', url: 'https://www.amazon.com'});
            chrome.bookmarks.create({title: 'eBay', url: 'https://www.ebay.com'});
            chrome.bookmarks.create({title: 'Gmail', url: 'https://www.gmail.com/'});
            chrome.bookmarks.create({title: 'Google', url: 'https://www.google.com'});
            chrome.bookmarks.create({title: 'YouTube', url: 'https://www.youtube.com'});
            chrome.bookmarks.create({title: 'Facebook', url: 'https://www.facebook.com'});
            chrome.bookmarks.create({title: 'Wikipedia', url: 'https://www.wikipedia.org'});
            chrome.bookmarks.create({title: 'Instagram', url: 'https://www.instagram.com'});
            chrome.bookmarks.create({title: 'Baidu', url: 'https://www.baidu.com'});
            chrome.bookmarks.create({title: 'Yahoo', url: 'https://www.yahoo.com'});
            chrome.bookmarks.create({title: 'WhatsApp', url: 'https://www.whatsapp.com'});
            chrome.bookmarks.create({title: 'Twitter', url: 'https://www.twitter.com'});
            chrome.bookmarks.create({title: 'TikTok', url: 'https://www.tiktok.com'});
            chrome.bookmarks.create({title: 'Reddit', url: 'https://www.reddit.com'});
            chrome.bookmarks.create({title: 'Bing', url: 'https://www.bing.com'});
            chrome.bookmarks.create({title: 'LinkedIn', url: 'https://www.linkedin.com'});
            chrome.bookmarks.create({title: 'Office', url: 'https://www.office.com'});
            chrome.bookmarks.create({title: 'Netflix', url: 'https://www.netflix.com'});
            chrome.bookmarks.create({title: 'DuckDuckGo', url: 'https://www.duckduckgo.com'});
            chrome.bookmarks.create({title: 'Pinterest', url: 'https://www.pinterest.com'});
            chrome.bookmarks.create({title: 'Live', url: 'https://www.live.com'});
        });
        //add 3 links to a reading list
        await driver.executeScript(() => {
            chrome.readingList.addEntry({title: 'Amazon', url: 'https://www.amazon.com',hasBeenRead: false});
            chrome.readingList.addEntry({title: 'eBay', url: 'https://www.ebay.com',hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Gmail', url: 'https://www.gmail.com/',hasBeenRead: false});
        });
        //add 3 links to a history
        await driver.executeScript(() => {
            chrome.history.addUrl({url: 'https://www.google.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.youtube.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.facebook.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.wikipedia.org'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.instagram.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.baidu.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.yahoo.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.whatsapp.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.twitter.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.amazon.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.tiktok.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.reddit.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.bing.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.linkedin.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.office.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.netflix.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.duckduckgo.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.pinterest.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.live.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.ebay.com'}, () => {
            });
        });
        //focus on the first opened tab
        await driver.sleep(DEFAULT_SLEEP);
        const handles = await driver.getAllWindowHandles();
        await driver.switchTo().window(handles[0]);
        await driver.sleep(DEFAULT_SLEEP);

        //open history dialog
        await driver.actions().move({x: 200, y: 200, origin: background2}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //click on shHist
        const shHist = await driver.findElement(By.id('shHist'));
        await shHist.click();
        await driver.sleep(DEFAULT_SLEEP);
        //check that the history dialog is opened
        const historyDialog = await driver.findElement(By.id('history-popup'));
        const historyDialogContent = await driver.findElement(By.id('history,popup-content'));
        assert(await historyDialog.isDisplayed(), 'History dialog should be displayed');
        //check that the history dialog has 3 items
        const historyItems = await historyDialogContent.findElements(By.xpath('./*'));
        assert.strictEqual(historyItems.length, 21, 'History dialog should have 3 items');
        await driver.sleep(DEFAULT_SLEEP);
        //click on the overlay
        const overlay = await driver.findElement(By.id('overlay'));
        await driver.actions().move({x: -100, y: 100, origin: overlay}).click().perform();
        //open open-tabs dialog
        await driver.actions().move({x: 200, y: 200, origin: background2}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //click on shTabs
        const shTabs = await driver.findElement(By.id('shTab'));
        await shTabs.click();
        await driver.sleep(DEFAULT_SLEEP);
        //check that the open-tabs dialog is opened
        const openTabsDialog = await driver.findElement(By.id('open-tabs-popup'));
        const openTabsDialogContent = await driver.findElement(By.id('open-tabs,popup-content'));
        assert(await openTabsDialog.isDisplayed(), 'Open tabs dialog should be displayed');
        //check that the open-tabs dialog has 3 items
        const openTabsItems = await openTabsDialogContent.findElements(By.xpath('./*'));
        assert.strictEqual(openTabsItems.length, 3, 'Open tabs dialog should have 3 items');
        await driver.sleep(DEFAULT_SLEEP);
        //click on the overlay
        const overlay2 = await driver.findElement(By.id('overlay'));
        await driver.actions().move({x: -100, y: 100, origin: overlay2}).click().perform();
        //open bookmarks dialog
        await driver.actions().move({x: 200, y: 200, origin: background2}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //click on shBkm
        const shBkm = await driver.findElement(By.id('shBok'));
        await shBkm.click();
        await driver.sleep(DEFAULT_SLEEP);
        //check that the bookmark dialog is opened
        const bookmarksDialog = await driver.findElement(By.id('bookmarks-popup'));
        const bookmarksDialogContent = await driver.findElement(By.id('bookmarks,popup-content'));
        assert(await bookmarksDialog.isDisplayed(), 'Bookmarks dialog should be displayed');
        //check that the bookmark dialog has 3 items
        const bookmarksItems = await bookmarksDialogContent.findElements(By.xpath('./*'));
        assert.strictEqual(bookmarksItems.length, 21, 'Bookmarks dialog should have 21 items');
        await driver.sleep(DEFAULT_SLEEP);
        //click on the overlay
        const overlay3 = await driver.findElement(By.id('overlay'));
        await driver.actions().move({x: -100, y: 100, origin: overlay3}).click().perform();
        //open the reading list dialog
        await driver.actions().move({x: 200, y: 200, origin: background2}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //click on shRList
        const shRList = await driver.findElement(By.id('shRdngLst'));
        await shRList.click();
        await driver.sleep(DEFAULT_SLEEP);
        //check that the readingList dialog is opened
        const readingListDialog = await driver.findElement(By.id('reading-list-popup'));
        const readingListDialogContent = await driver.findElement(By.id('reading-list,popup-content'));
        assert(await readingListDialog.isDisplayed(), 'Reading list dialog should be displayed');
        //check that the readingList dialog has 3 items
        const readingListItems = await readingListDialogContent.findElements(By.xpath('./*'));
        assert.strictEqual(readingListItems.length, 3, 'Reading list dialog should have 3 items');
        await driver.sleep(DEFAULT_SLEEP);
        await driver.quit();
    });
    it('should add items and stations', async () => {
        let driver = await buildDriver();
        await navigateToExtension(driver);
        await driver.sleep(DEFAULT_SLEEP);
        await driver.executeScript('window.open("https://www.amazon.com")');
        await driver.executeScript('window.open("https://www.ebay.com")');
        await driver.executeScript('window.open("https://www.gmail.com/")');
        await driver.executeScript('window.open("https://www.chatgpt.com/")');
        await driver.executeScript('window.open("https://www.google.com/search?q=tesla+model+s+model+x")');
        await driver.executeScript('window.open("https://www.google.com/search?q=tesla+model+s+model+x")');
        await driver.executeScript('window.open("https://www.youtube.com/results?search_query=techno+remix")');
        await driver.executeScript('window.open("https://chromewebstore.google.com/category/extensions")');
        await driver.executeScript('window.open("https://www.google.com/search?q=books+animated+gif")');
        //add 3 links to bookmarks
        await driver.executeScript(() => {
            chrome.bookmarks.create({title: 'Amazon', url: 'https://www.amazon.com'});
            chrome.bookmarks.create({title: 'eBay', url: 'https://www.ebay.com'});
            chrome.bookmarks.create({title: 'Gmail', url: 'https://www.gmail.com/'});
            chrome.bookmarks.create({title: 'Google', url: 'https://www.google.com'});
            chrome.bookmarks.create({title: 'YouTube', url: 'https://www.youtube.com'});
            chrome.bookmarks.create({title: 'Facebook', url: 'https://www.facebook.com'});
            chrome.bookmarks.create({title: 'Wikipedia', url: 'https://www.wikipedia.org'});
            chrome.bookmarks.create({title: 'Instagram', url: 'https://www.instagram.com'});
            chrome.bookmarks.create({title: 'Baidu', url: 'https://www.baidu.com'});
            chrome.bookmarks.create({title: 'Yahoo', url: 'https://www.yahoo.com'});
            chrome.bookmarks.create({title: 'WhatsApp', url: 'https://www.whatsapp.com'});
            chrome.bookmarks.create({title: 'Twitter', url: 'https://www.twitter.com'});
            chrome.bookmarks.create({title: 'TikTok', url: 'https://www.tiktok.com'});
            chrome.bookmarks.create({title: 'Reddit', url: 'https://www.reddit.com'});
            chrome.bookmarks.create({title: 'Bing', url: 'https://www.bing.com'});
            chrome.bookmarks.create({title: 'LinkedIn', url: 'https://www.linkedin.com'});
            chrome.bookmarks.create({title: 'Office', url: 'https://www.office.com'});
            chrome.bookmarks.create({title: 'Netflix', url: 'https://www.netflix.com'});
            chrome.bookmarks.create({title: 'DuckDuckGo', url: 'https://www.duckduckgo.com'});
            chrome.bookmarks.create({title: 'Pinterest', url: 'https://www.pinterest.com'});
            chrome.bookmarks.create({title: 'Live', url: 'https://www.live.com'});
        });
        //add 3 links to a reading list
        await driver.executeScript(() => {
            chrome.readingList.addEntry({title: 'Amazon', url: 'https://www.amazon.com',hasBeenRead: false});
            chrome.readingList.addEntry({title: 'eBay', url: 'https://www.ebay.com',hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Gmail', url: 'https://www.gmail.com/',hasBeenRead: false});
        });
        //add 3 links to a history
        await driver.executeScript(() => {
            chrome.history.addUrl({url: 'https://www.google.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.youtube.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.facebook.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.wikipedia.org'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.instagram.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.baidu.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.yahoo.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.whatsapp.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.twitter.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.amazon.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.tiktok.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.reddit.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.bing.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.linkedin.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.office.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.netflix.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.duckduckgo.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.pinterest.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.live.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.ebay.com'}, () => {
            });
        });
        //focus on the first opened tab
        await driver.sleep(DEFAULT_SLEEP);
        const handles = await driver.getAllWindowHandles();
        await driver.switchTo().window(handles[0]);
        await driver.sleep(DEFAULT_SLEEP);

        //add the first item to the background
        const background = await driver.findElement(By.id('background'));
        await driver.actions().move({x: 1, y: -150, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //create item
        const adItemBtn = await driver.findElement(By.id('adItBtn'));
        const adItemInp = await driver.findElement(By.id('adItInp'));
        await adItemInp.clear();
        await adItemInp.sendKeys('Most used');
        await adItemBtn.click();
        const item = await driver.findElement(By.id('0,0,i'));
        const itemElement = await driver.findElement(By.id('0,0,i,title'));
        const itemTitle = await itemElement.getAttribute('innerHTML');
        assert.strictEqual(itemTitle, 'Most used', 'Item title should be Most used');
        //check that the item is placed at the correct position
        //open the context menu on the item
        await driver.actions().move({origin: item}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //click on chgObjIc
        const chgObjIc = await driver.findElement(By.id('chgObjIc'));
        await chgObjIc.click();
        await driver.sleep(DEFAULT_SLEEP);
        //Get new-link-inp
        const new_link_inp = await driver.findElement(By.id('new-link-inp'));
        await new_link_inp.sendKeys('https://i.pinimg.com/originals/04/c4/a8/04c4a8baf0068b244bed7b7df509898f.gif');
        //click on add-new-link-btn
        const add_new_link_btn = await driver.findElement(By.id('add-new-link-btn'));
        await add_new_link_btn.click();
        await driver.sleep(DEFAULT_SLEEP);
        //click on the new GIF gifs,2
        const newGif = await driver.findElement(By.id('gifs,2'));

        await newGif.click();
        await driver.sleep(DEFAULT_SLEEP);
        const overlayFirst = await driver.findElement(By.id('overlay'));
        await driver.actions().move({x: -100, y: 100, origin: overlayFirst}).click().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //check that the item has the new GIF
        const itemImg = await driver.findElement(By.id('0,0,i,img'));

        //open Open-tabs dialog
        await driver.actions().move({origin: background}).contextClick().perform();
        //click on shTabs
        const shTabsFirst = await driver.findElement(By.id('shTab'));
        await shTabsFirst.click();
        await driver.sleep(DEFAULT_SLEEP);
        //drag and drop the fourth tab from the open-tabs dialog to the item
        const fourthElement = await driver.findElement(By.css('[title="ChatGPT"]'));
        //drag and drop the fourth tab from the open-tabs dialog to the item
        const itemElementFirst = await driver.findElement(By.id('0,0,i'));
        await driver.actions().dragAndDrop(fourthElement, itemElementFirst).perform();
        await driver.sleep(DEFAULT_SLEEP);
        //open bookmarks dialog
        await driver.actions().move({x: -100, y: -100, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //click on shBkm
        const shBkmFirst = await driver.findElement(By.id('shBok'));
        await shBkmFirst.click();
        await driver.sleep(DEFAULT_SLEEP);
        const fifthElement = await driver.findElement(By.css('[title="YouTube"]'));
        //drag and drop the fifth bookmark from the bookmarks dialog to the item
        await driver.actions().dragAndDrop(fifthElement, itemElementFirst).perform();
        await driver.sleep(DEFAULT_SLEEP);


        //add a second item to the background top: 406px; left: 1221px;
        await driver.actions().move({x: 70, y: 110, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //create item
        const adItemBtn2 = await driver.findElement(By.id('adItBtn'));
        const adItemInp2 = await driver.findElement(By.id('adItInp'));
        await adItemInp2.clear();
        await adItemInp2.sendKeys('Shopping');
        await adItemBtn2.click();
        const item2 = await driver.findElement(By.id('0,1,i'));
        const itemElement2 = await driver.findElement(By.id('0,1,i,title'));
        const itemTitle2 = await itemElement2.getAttribute('innerHTML');
        assert.strictEqual(itemTitle2, 'Shopping', 'Item title should be Shopping');
        //check that the item is placed at the correct position
        const itemLocation2 = await itemElement2.getRect();
        assert.strictEqual(itemLocation2.x, 1171, 'Item should be placed at 1171px left');
        assert.strictEqual(itemLocation2.y, 606, 'Item should be placed at 606px top');
        //open the context menu on the item
        await driver.actions().move({origin: item2}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //click on chgObjIc
        const chgObjIc2 = await driver.findElement(By.id('chgObjIc'));
        await chgObjIc2.click();
        await driver.sleep(DEFAULT_SLEEP);
        //Get new-link-inp
        const new_link_inp2 = await driver.findElement(By.id('new-link-inp'));
        await new_link_inp2.sendKeys('https://media.baamboozle.com/uploads/images/323666/1624532385_171205_gif-url.gif');
        //click on add-new-link-btn
        const add_new_link_btn2 = await driver.findElement(By.id('add-new-link-btn'));
        await add_new_link_btn2.click();
        await driver.sleep(DEFAULT_SLEEP);
        //click on the new GIF gifs,3
        const newGif2 = await driver.findElement(By.id('gifs,3'));
        const newGifSrc2 = await newGif2.getAttribute('src');
        await newGif2.click();
        await driver.sleep(DEFAULT_SLEEP);
        const overlaySecond = await driver.findElement(By.id('overlay'));
        await driver.actions().move({x: -100, y: 100, origin: overlaySecond}).click().perform();
        await driver.sleep(DEFAULT_SLEEP);

        //open Open-tabs dialog
        await driver.actions().move({origin: background}).contextClick().perform();
        //click on shTabs
        const shTabsSecond = await driver.findElement(By.id('shTab'));
        await shTabsSecond.click();
        await driver.sleep(DEFAULT_SLEEP);
        //drag and drop the fourth tab from the open-tabs dialog to the item
        const secondElement = await driver.findElement(By.css('[title="Electronics, Cars, Fashion, Collectibles & More | eBay"]'));
        //drag and drop the fourth tab from the open-tabs dialog to the item
        const itemElementSecond = await driver.findElement(By.id('0,1,i'));
        await driver.actions().dragAndDrop(secondElement, itemElementSecond).perform();
        await driver.sleep(DEFAULT_SLEEP);
        //open bookmarks dialog
        await driver.actions().move({x: 200, y: 200, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //click on shBkm
        const shBkmSecond = await driver.findElement(By.id('shBok'));
        await shBkmSecond.click();
        await driver.sleep(DEFAULT_SLEEP);
        const firstElement = await driver.findElement(By.css('[title="Amazon"]'));
        //drag and drop the fifth bookmark from the bookmarks dialog to the item
        await driver.actions().dragAndDrop(firstElement, itemElementSecond).perform();
        await driver.sleep(DEFAULT_SLEEP);

        //add a first station to the background x:1003; y: 510
        await driver.actions().move({x: -60, y: 100, origin: background}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //create station
        const adStationBtn = await driver.findElement(By.id('adStBtn'));
        const adStationInp = await driver.findElement(By.id('adStInp'));
        await adStationInp.clear();
        await adStationInp.sendKeys('Apartment');
        await adStationBtn.click();
        await driver.sleep(DEFAULT_SLEEP);
        const stationElement = await driver.findElement(By.id('0,0,s'));
        //check that the item is placed at the correct position
        //open the context menu on the item
        await driver.actions().move({origin: stationElement}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //click on chgObjIc
        const chgObjIc3 = await driver.findElement(By.id('chgObjIc'));
        await chgObjIc3.click();
        await driver.sleep(DEFAULT_SLEEP);
        //Get new-link-inp
        const new_link_inp3 = await driver.findElement(By.id('new-link-inp'));
        await new_link_inp3.sendKeys('https://upload.wikimedia.org/wikipedia/commons/6/6a/Orange_animated_left_arrow.gif');
        //click on add-new-link-btn
        const add_new_link_btn3 = await driver.findElement(By.id('add-new-link-btn'));
        await add_new_link_btn3.click();
        await driver.sleep(DEFAULT_SLEEP);
        //click on the new GIF gifs,4
        const newGif3 = await driver.findElement(By.id('gifs,4'));
        await newGif3.click();
        await driver.sleep(DEFAULT_SLEEP);
        const overlayThird = await driver.findElement(By.id('overlay'));
        await driver.actions().move({x: -100, y: -100, origin: overlayThird}).click().perform();
        await driver.sleep(DEFAULT_SLEEP);
        await stationElement.click();


        //add new item in the new view
        const background2 = await driver.findElement(By.id('background'));
        await driver.sleep(DEFAULT_SLEEP);
        await driver.actions().move({x: 250, y: 0, origin: background2}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //create item
        const adItemBtn3 = await driver.findElement(By.id('adItBtn'));
        const adItemInp3 = await driver.findElement(By.id('adItInp'));
        await adItemInp3.clear();
        await adItemInp3.sendKeys('Reading');
        await adItemBtn3.click();
        const item3 = await driver.findElement(By.id('1,0,i'));
        const itemElement3 = await driver.findElement(By.id('1,0,i,title'));
        const itemTitle3 = await itemElement3.getAttribute('innerHTML');
        assert.strictEqual(itemTitle3, 'Reading', 'Item title should be Reading');
        //check that the item is placed at the correct position
        const itemLocation3 = await itemElement3.getRect();
        //open the context menu on the item
        await driver.actions().move({origin: item3}).contextClick().perform();
        await driver.sleep(DEFAULT_SLEEP);
        //click on chgObjIc
        const chgObjIc4 = await driver.findElement(By.id('chgObjIc'));
        await chgObjIc4.click();
        await driver.sleep(DEFAULT_SLEEP);
        //Get new-link-inp
        const new_link_inp4 = await driver.findElement(By.id('new-link-inp'));
        await new_link_inp4.sendKeys('https://bookscador-pi.vercel.app/_next/image?url=https%3A%2F%2Fres.cloudinary.com%2Fknowhere%2Fimage%2Fupload%2Fv1667690640%2FBookscador%2Fstatic%2Fbooks-gif-unscreen_xvsiyu.gif&w=640&q=75');
        //click on add-new-link-btn
        const add_new_link_btn4 = await driver.findElement(By.id('add-new-link-btn'));
        await add_new_link_btn4.click();
        await driver.sleep(DEFAULT_SLEEP);
        const newGif4 = await driver.findElement(By.id('gifs,4'));
        await newGif4.click();
        await driver.sleep(DEFAULT_SLEEP);
        const overlay4 = await driver.findElement(By.id('overlay'));
        await driver.actions().move({x: -100, y: 100, origin: overlay4}).click().perform();
        await driver.sleep(DEFAULT_SLEEP);
    });
    it('should load items and stations', async () => {
        let driver = await buildDriver();
        await navigateToExtension(driver);
        await driver.sleep(DEFAULT_SLEEP);
        await driver.executeScript('window.open("https://www.amazon.com")');
        await driver.executeScript('window.open("https://www.ebay.com")');
        await driver.executeScript('window.open("https://www.gmail.com/")');
        await driver.executeScript('window.open("https://www.chatgpt.com/")');
        await driver.executeScript('window.open("https://www.google.com/search?q=tesla+model+s+model+x")');
        await driver.executeScript('window.open("https://www.google.com/search?q=tesla+model+s+model+x")');
        await driver.executeScript('window.open("https://www.youtube.com/results?search_query=techno+remix")');
        await driver.executeScript('window.open("https://chromewebstore.google.com/category/extensions")');
        await driver.executeScript('window.open("https://www.google.com/search?q=books+animated+gif")');
        //add 3 links to bookmarks
        await driver.executeScript(() => {
            chrome.bookmarks.create({title: 'Amazon', url: 'https://www.amazon.com'});
            chrome.bookmarks.create({title: 'eBay', url: 'https://www.ebay.com'});
            chrome.bookmarks.create({title: 'Gmail', url: 'https://www.gmail.com/'});
            chrome.bookmarks.create({title: 'Google', url: 'https://www.google.com'});
            chrome.bookmarks.create({title: 'YouTube', url: 'https://www.youtube.com'});
            chrome.bookmarks.create({title: 'Facebook', url: 'https://www.facebook.com'});
            chrome.bookmarks.create({title: 'Wikipedia', url: 'https://www.wikipedia.org'});
            chrome.bookmarks.create({title: 'Instagram', url: 'https://www.instagram.com'});
            chrome.bookmarks.create({title: 'Baidu', url: 'https://www.baidu.com'});
            chrome.bookmarks.create({title: 'Yahoo', url: 'https://www.yahoo.com'});
            chrome.bookmarks.create({title: 'WhatsApp', url: 'https://www.whatsapp.com'});
            chrome.bookmarks.create({title: 'Twitter', url: 'https://www.twitter.com'});
            chrome.bookmarks.create({title: 'TikTok', url: 'https://www.tiktok.com'});
            chrome.bookmarks.create({title: 'Reddit', url: 'https://www.reddit.com'});
            chrome.bookmarks.create({title: 'Bing', url: 'https://www.bing.com'});
            chrome.bookmarks.create({title: 'LinkedIn', url: 'https://www.linkedin.com'});
            chrome.bookmarks.create({title: 'Office', url: 'https://www.office.com'});
            chrome.bookmarks.create({title: 'Netflix', url: 'https://www.netflix.com'});
            chrome.bookmarks.create({title: 'DuckDuckGo', url: 'https://www.duckduckgo.com'});
            chrome.bookmarks.create({title: 'Pinterest', url: 'https://www.pinterest.com'});
            chrome.bookmarks.create({title: 'Live', url: 'https://www.live.com'});
        });
        //add 3 links to a reading list
        await driver.executeScript(() => {
            chrome.readingList.addEntry({title: 'Amazon', url: 'https://www.amazon.com',hasBeenRead: false});
            chrome.readingList.addEntry({title: 'eBay', url: 'https://www.ebay.com',hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Gmail', url: 'https://www.gmail.com/',hasBeenRead: false});
        });
        //add 3 links to a history
        await driver.executeScript(() => {
            chrome.history.addUrl({url: 'https://www.google.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.youtube.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.facebook.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.wikipedia.org'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.instagram.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.baidu.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.yahoo.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.whatsapp.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.twitter.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.amazon.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.tiktok.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.reddit.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.bing.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.linkedin.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.office.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.netflix.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.duckduckgo.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.pinterest.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.live.com'}, () => {
            });
            chrome.history.addUrl({url: 'https://www.ebay.com'}, () => {
            });
        });
        //focus on the first opened tab
        await driver.sleep(DEFAULT_SLEEP);
        const handles = await driver.getAllWindowHandles();
        await driver.switchTo().window(handles[0]);
        await driver.sleep(DEFAULT_SLEEP);

        //load data to chrome.storage.local
        await driver.executeScript(() => {
            chrome.storage.local.set(
                {
                    "0": {
                        "background": "images/Cartoon Landscape.jpg",
                        "dummies": [],
                        "id": "0",
                        "items": [
                            0,
                            1,
                            2
                        ],
                        "stations": [
                            0,
                            1,
                            2
                        ]
                    },
                    "1": {
                        "background": "images/living-room-animation.jpg",
                        "dummies": [],
                        "id": "1",
                        "items": [
                            0
                        ],
                        "parent": "0",
                        "stations": []
                    },
                    "2": {
                        "background": "https://weadesign.com/wp-content/uploads/2024/02/apartment-interior-design.webp",
                        "dummies": [],
                        "id": "2",
                        "items": [
                            0
                        ],
                        "parent": "0",
                        "stations": [
                            0
                        ]
                    },
                    "3": {
                        "background": "https://media.designcafe.com/wp-content/uploads/2022/03/04164440/pink-girl-bedroom-design-ideas.jpg",
                        "dummies": [],
                        "id": "3",
                        "items": [
                            0
                        ],
                        "parent": "2",
                        "stations": []
                    },
                    "4": {
                        "background": "https://image.cdn2.seaart.me/2023-05-31/29331243397189/5da67a4a7c11a9aa0c5539acf26e3ffd80b93cce_high.webp",
                        "dummies": [],
                        "id": "4",
                        "items": [
                            0
                        ],
                        "parent": "0",
                        "stations": []
                    },
                    "0,0,i": {
                        "faviconChrome": "false",
                        "height": "64px",
                        "icon": "https://i.pinimg.com/originals/04/c4/a8/04c4a8baf0068b244bed7b7df509898f.gif",
                        "id": "0,0,i",
                        "left": "1102px",
                        "links": [
                            0,
                            1
                        ],
                        "title": "Most used",
                        "top": "346px",
                        "type": "item",
                        "view": "0",
                        "width": "64px",
                        "zIndex": "0"
                    },
                    "0,0,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://chatgpt.com/",
                        "id": "0,0,i,0",
                        "link": "https://chatgpt.com/",
                        "title": "ChatGPT",
                        "view": "0"
                    },
                    "0,0,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.youtube.com/",
                        "id": "0,0,i,1",
                        "link": "https://www.youtube.com/",
                        "title": "YouTube",
                        "view": "0"
                    },
                    "0,0,s": {
                        "height": "54px",
                        "icon": "https://upload.wikimedia.org/wikipedia/commons/6/6a/Orange_animated_left_arrow.gif",
                        "id": "0,0,s",
                        "left": "1006px",
                        "target": 1,
                        "title": "Apartment",
                        "top": "498px",
                        "type": "station",
                        "view": "0",
                        "width": "36px"
                    },
                    "0,1,i": {
                        "faviconChrome": "false",
                        "height": "120px",
                        "icon": "https://media.baamboozle.com/uploads/images/323666/1624532385_171205_gif-url.gif",
                        "id": "0,1,i",
                        "left": "1323px",
                        "links": [
                            0,
                            1
                        ],
                        "title": "Shopping",
                        "top": "529px",
                        "type": "item",
                        "view": "0",
                        "width": "100px"
                    },
                    "0,1,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://www.ebay.com/",
                        "id": "0,1,i,0",
                        "link": "https://www.ebay.com/",
                        "title": "Electronics, Cars, Fashion, Collectibles & More | eBay",
                        "view": "0"
                    },
                    "0,1,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.amazon.com/",
                        "id": "0,1,i,1",
                        "link": "https://www.amazon.com/",
                        "title": "Amazon",
                        "view": "0"
                    },
                    "0,1,s": {
                        "height": "376px",
                        "icon": "https://mir-s3-cdn-cf.behance.net/project_modules/source/ba467372969113.5bf9ecdda7cfb.gif",
                        "id": "0,1,s",
                        "left": "22px",
                        "target": 2,
                        "title": "new apartment",
                        "top": "181px",
                        "type": "station",
                        "view": "0",
                        "width": "369px"
                    },
                    "0,2,i": {
                        "faviconChrome": "false",
                        "height": "64px",
                        "icon": "https://i.pinimg.com/originals/cf/f8/1d/cff81d29fab592d2f86c2f81775731c4.gif",
                        "id": "0,2,i",
                        "left": "393px",
                        "links": [
                            0
                        ],
                        "title": "Cats movie",
                        "top": "609px",
                        "type": "item",
                        "view": "0",
                        "width": "64px"
                    },
                    "0,2,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://www.youtube.com/@SimonsCat",
                        "id": "0,2,i,0",
                        "link": "https://www.youtube.com/@SimonsCat",
                        "title": "Simon's Cat - YouTube",
                        "view": "0"
                    },
                    "0,2,s": {
                        "height": "64px",
                        "icon": "https://moein.video/wp-content/uploads/2022/10/arrow-Free-Animated-Icon-GIF-1080p-after-effects.gif",
                        "id": "0,2,s",
                        "left": "1844px",
                        "target": 4,
                        "title": "Another View",
                        "top": "11px",
                        "type": "station",
                        "view": "0",
                        "width": "64px"
                    },
                    "1,0,i": {
                        "faviconChrome": "false",
                        "height": "64px",
                        "icon": "https://bookscador-pi.vercel.app/_next/image?url=https%3A%2F%2Fres.cloudinary.com%2Fknowhere%2Fimage%2Fupload%2Fv1667690640%2FBookscador%2Fstatic%2Fbooks-gif-unscreen_xvsiyu.gif&w=640&q=75",
                        "id": "1,0,i",
                        "left": "1387px",
                        "links": [
                            0,
                            1
                        ],
                        "title": "Reading",
                        "top": "283px",
                        "type": "item",
                        "view": "1",
                        "width": "64px"
                    },
                    "1,0,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://www.duckduckgo.com/",
                        "id": "1,0,i,0",
                        "link": "https://www.duckduckgo.com/",
                        "title": "",
                        "view": "1"
                    },
                    "1,0,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.wikipedia.org/",
                        "id": "1,0,i,1",
                        "link": "https://www.wikipedia.org/",
                        "title": "",
                        "view": "1"
                    },
                    "2,0,i": {
                        "faviconChrome": "false",
                        "height": "86px",
                        "icon": "https://s3.eu-west-2.amazonaws.com/farming-foodsteps/images/MENU/lesson4.gif",
                        "id": "2,0,i",
                        "left": "80px",
                        "links": [
                            0
                        ],
                        "title": "Healthy food",
                        "top": "326px",
                        "type": "item",
                        "view": "2",
                        "width": "101px"
                    },
                    "2,0,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://www.bbcgoodfood.com/recipes/collection/quick-and-healthy-recipes",
                        "id": "2,0,i,0",
                        "link": "https://www.bbcgoodfood.com/recipes/collection/quick-and-healthy-recipes",
                        "title": "116 Quick & Healthy Recipes | Good Food",
                        "view": "2"
                    },
                    "2,0,s": {
                        "height": "193px",
                        "icon": "https://media1.giphy.com/media/v1.Y2lkPTZjMDliOTUyeGVyZ29wazA2ajlpYnpnejl0ZnRuNnVlemZnOGZmcHdtN2U1NmN0NiZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/OWEm5woQM5IskcNCwa/source.gif",
                        "id": "2,0,s",
                        "left": "939px",
                        "target": 3,
                        "title": "Hannah",
                        "top": "678px",
                        "type": "station",
                        "view": "2",
                        "width": "166px"
                    },
                    "3,0,i": {
                        "faviconChrome": "false",
                        "height": "73px",
                        "icon": "https://cdnfiles.j2bloggy.com/9846_b/wp-content/uploads/sites/342/2021/09/homework-gif.gif",
                        "id": "3,0,i",
                        "left": "542px",
                        "links": [
                            0
                        ],
                        "title": "Homework",
                        "top": "461px",
                        "type": "item",
                        "view": "3",
                        "width": "81px"
                    },
                    "3,0,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://chatgpt.com/",
                        "id": "3,0,i,0",
                        "link": "https://chatgpt.com/",
                        "title": "ChatGPT",
                        "view": "3"
                    },
                    "4,0,i": {
                        "faviconChrome": "false",
                        "height": "64px",
                        "icon": "https://i.pinimg.com/originals/cf/f8/1d/cff81d29fab592d2f86c2f81775731c4.gif",
                        "id": "4,0,i",
                        "left": "281px",
                        "links": [
                            0,
                            1,
                            2
                        ],
                        "title": "Another Item",
                        "top": "332px",
                        "type": "item",
                        "view": "4",
                        "width": "64px"
                    },
                    "4,0,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://www.youtube.com/",
                        "id": "4,0,i,0",
                        "link": "https://www.youtube.com/",
                        "title": "YouTube",
                        "view": "4"
                    },
                    "4,0,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.ebay.com/",
                        "id": "4,0,i,1",
                        "link": "https://www.ebay.com/",
                        "title": "eBay",
                        "view": "4"
                    },
                    "4,0,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://www.bbcgoodfood.com/recipes/collection/quick-and-healthy-recipes",
                        "id": "4,0,i,2",
                        "link": "https://www.bbcgoodfood.com/recipes/collection/quick-and-healthy-recipes",
                        "title": "116 Quick & Healthy Recipes | Good Food",
                        "view": "4"
                    },
                    "backgrounds": {
                        "id": "backgrounds",
                        "links": [
                            0,
                            1,
                            2,
                            3,
                            4,
                            5
                        ]
                    },
                    "backgrounds,0": {
                        "id": "backgrounds,0",
                        "link": "/images/Cartoon Landscape.jpg",
                        "title": "Cartoon Landscapes Vector Background",
                        "view": 0
                    },
                    "backgrounds,1": {
                        "id": "backgrounds,1",
                        "link": "/images/House-Interior.jpg",
                        "title": "House Interior",
                        "view": 0
                    },
                    "backgrounds,2": {
                        "id": "backgrounds,2",
                        "link": "/images/living-room-animation.jpg",
                        "title": "living room",
                        "view": 0
                    },
                    "backgrounds,3": {
                        "id": "backgrounds,3",
                        "link": "https://weadesign.com/wp-content/uploads/2024/02/apartment-interior-design.webp",
                        "title": "https://weadesign.com/wp-content/uploads/2024/02/apartment-interior-design.webp"
                    },
                    "backgrounds,4": {
                        "id": "backgrounds,4",
                        "link": "https://media.designcafe.com/wp-content/uploads/2022/03/04164440/pink-girl-bedroom-design-ideas.jpg",
                        "title": "https://media.designcafe.com/wp-content/uploads/2022/03/04164440/pink-girl-bedroom-design-ideas.jpg"
                    },
                    "backgrounds,5": {
                        "id": "backgrounds,5",
                        "link": "https://image.cdn2.seaart.me/2023-05-31/29331243397189/5da67a4a7c11a9aa0c5539acf26e3ffd80b93cce_high.webp",
                        "title": "https://image.cdn2.seaart.me/2023-05-31/29331243397189/5da67a4a7c11a9aa0c5539acf26e3ffd80b93cce_high.webp"
                    },
                    "bookmarks": {
                        "faviconChrome": "false",
                        "id": "bookmarks"
                    },
                    "gifs": {
                        "id": "gifs",
                        "links": [
                            0,
                            1,
                            2,
                            3,
                            4,
                            5,
                            6,
                            7,
                            8,
                            9,
                            10,
                            11,
                            12
                        ]
                    },
                    "gifs,0": {
                        "id": "gifs,0",
                        "link": "/images/yellow big house.png",
                        "title": "yellow big house",
                        "view": 0
                    },
                    "gifs,1": {
                        "id": "gifs,1",
                        "link": "/images/folder.png",
                        "title": "Folder",
                        "view": 0
                    },
                    "gifs,10": {
                        "id": "gifs,10",
                        "link": "https://media1.giphy.com/media/v1.Y2lkPTZjMDliOTUyeGVyZ29wazA2ajlpYnpnejl0ZnRuNnVlemZnOGZmcHdtN2U1NmN0NiZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/OWEm5woQM5IskcNCwa/source.gif",
                        "title": "Happy"
                    },
                    "gifs,11": {
                        "id": "gifs,11",
                        "link": "https://cdnfiles.j2bloggy.com/9846_b/wp-content/uploads/sites/342/2021/09/homework-gif.gif",
                        "title": "https://cdnfiles.j2bloggy.com/9846_b/wp-content/uploads/sites/342/2021/09/homework-gif.gif"
                    },
                    "gifs,12": {
                        "id": "gifs,12",
                        "link": "https://moein.video/wp-content/uploads/2022/10/arrow-Free-Animated-Icon-GIF-1080p-after-effects.gif",
                        "title": "https://moein.video/wp-content/uploads/2022/10/arrow-Free-Animated-Icon-GIF-1080p-after-effects.gif"
                    },
                    "gifs,2": {
                        "id": "gifs,2",
                        "link": "https://i.pinimg.com/originals/04/c4/a8/04c4a8baf0068b244bed7b7df509898f.gif",
                        "title": "https://i.pinimg.com/originals/04/c4/a8/04c4a8baf0068b244bed7b7df509898f.gif"
                    },
                    "gifs,3": {
                        "id": "gifs,3",
                        "link": "https://media.baamboozle.com/uploads/images/323666/1624532385_171205_gif-url.gif",
                        "title": "https://media.baamboozle.com/uploads/images/323666/1624532385_171205_gif-url.gif"
                    },
                    "gifs,4": {
                        "id": "gifs,4",
                        "link": "https://upload.wikimedia.org/wikipedia/commons/6/6a/Orange_animated_left_arrow.gif",
                        "title": "https://upload.wikimedia.org/wikipedia/commons/6/6a/Orange_animated_left_arrow.gif"
                    },
                    "gifs,5": {
                        "id": "gifs,5",
                        "link": "https://bookscador-pi.vercel.app/_next/image?url=https%3A%2F%2Fres.cloudinary.com%2Fknowhere%2Fimage%2Fupload%2Fv1667690640%2FBookscador%2Fstatic%2Fbooks-gif-unscreen_xvsiyu.gif&w=640&q=75",
                        "title": "https://bookscador-pi.vercel.app/_next/image?url=https%3A%2F%2Fres.cloudinary.com%2Fknowhere%2Fimage%2Fupload%2Fv1667690640%2FBookscador%2Fstatic%2Fbooks-gif-unscreen_xvsiyu.gif&w=640&q=75"
                    },
                    "gifs,6": {
                        "id": "gifs,6",
                        "link": "https://i.pinimg.com/originals/cf/f8/1d/cff81d29fab592d2f86c2f81775731c4.gif",
                        "title": "cat jumping"
                    },
                    "gifs,8": {
                        "id": "gifs,8",
                        "link": "https://mir-s3-cdn-cf.behance.net/project_modules/source/ba467372969113.5bf9ecdda7cfb.gif",
                        "title": "https://mir-s3-cdn-cf.behance.net/project_modules/source/ba467372969113.5bf9ecdda7cfb.gif"
                    },
                    "gifs,9": {
                        "id": "gifs,9",
                        "link": "https://s3.eu-west-2.amazonaws.com/farming-foodsteps/images/MENU/lesson4.gif",
                        "title": "https://s3.eu-west-2.amazonaws.com/farming-foodsteps/images/MENU/lesson4.gif"
                    },
                    "history": {
                        "faviconChrome": "false",
                        "id": "history"
                    },
                    "lastStationViewId": {
                        "viewId": [
                            1,
                            2,
                            3,
                            4
                        ]
                    },
                    "openTabs": {
                        "faviconChrome": "false",
                        "id": "openTabs"
                    },
                    "readingList": {
                        "faviconChrome": "false",
                        "id": "readingList"
                    },
                    "trash": {
                        "id": "trash",
                        "links": []
                    }
                }
            );
        })
        await driver.navigate().refresh();
        await driver.quit();

    });

});
