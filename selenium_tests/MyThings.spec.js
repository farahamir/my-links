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

async function openContextMenu(driver, elementId, x = 0, y = 0) {
    const element = await driver.findElement(By.id(elementId));
    await driver.actions().move({x: x, y: y, origin: element}).contextClick().perform();
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

async function buildDriverDocker() {
    const options = new Chrome.Options();
    return new Builder()
        .forBrowser(Browser.CHROME)
        .setChromeOptions(
            options
                .addArguments("--start-maximized", "--disable-infobars", "--disable-dev-shm-usage", "--no-sandbox")
                .excludeSwitches(['enable-automation'])
        )
        .usingServer('http://localhost:4444/wd/hub')
        .build()
        .then(async driver => {
            await navigateToExtension(driver); // Wait until the extension is loaded
            return driver;
        });
}
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
        assert.strictEqual(await driver.getTitle(), 'VisuaLinks');
        await driver.quit();
    });
    it('Check Elements', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver); await loadTestingDataToChromeStorage(driver);
        assert.strictEqual(await driver.getTitle(), 'VisuaLinks');

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

        // Open context menu from a background
        const background = await driver.findElement(By.id('background'));
        await driver.actions().contextClick(background).perform();
        await driver.sleep(DEFAULT_SLEEP);

        // Check that a context menu is displayed
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
        await driver.sleep(DEFAULT_SLEEP * 5);

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
    it('Add new Dummy from context menu delete and add again new one then validate the change in html and chrome.storage.local', async function () {
        let driver = await buildDriver();
        await navigateToExtension(driver);
        await loadTestingDataToChromeStorage(driver);

        // Open context menu and add new dummyToDelete
        await openContextMenu(driver, 'background');
        await clickElement(driver, 'adDumBtn');

        // Check for console errors
        await checkNoConsoleErrors(driver);

        // Get storage data
        let result = await getStorageData(driver);
        let map = new Map(Object.entries(result));

        // Validate storage data
        assert(map.has('0,5,d'), 'Dummy with id 0,5,d should be present in storage');
        let item = map.get('0');
        assert(item.dummies.includes(5), 'Item with id 0 should have dummyToDelete 5 in dummies array');

        // Validate HTML element exists
        await assertElementExists(driver, '0,5,d');

        // Open context menu and add new dummyToDelete
        await openContextMenu(driver, 'background',200,200);
        await clickElement(driver, 'adDumBtn');

        // Check for console errors
        await checkNoConsoleErrors(driver);

        // Get storage data
        result = await getStorageData(driver);
        map = new Map(Object.entries(result));

        // Validate storage data
        assert(map.has('0,6,d'), 'Dummy with id 0,6,d should be present in storage');
        item = map.get('0');
        assert(item.dummies.includes(6), 'Item with id 0 should have dummyToDelete 6 in dummies array');

        // Validate HTML element exists
        await assertElementExists(driver, '0,6,d');

        await driver.sleep(DEFAULT_SLEEP*2);

        //delete dummyToDelete
        const dummyToDelete = await driver.findElement(By.id('0,5,d'));

        await driver.actions().move({origin: dummyToDelete}).perform();

        // Trigger the contextmenu event
        await driver.actions().contextClick(dummyToDelete).perform();

        // Wait for the context menu to appear and verify its presence
        const remDummyMenu = await driver.findElement(By.id('remDummy'));

        assert(await remDummyMenu.isDisplayed(), 'Remove Dummy menu should be displayed');

        await remDummyMenu.click();
        //confirm the deletion prompt by clicking on The Alert confirm button
        await driver.switchTo().alert().accept();

        //check that dummyToDelete with id 0,5,d is not present in the html
        let dummyElement;
        try {
            dummyElement = await driver.findElement(By.id('0,5,d'));
        } catch (e) {
            dummyElement = null;
        }
        assert(!dummyElement, 'Dummy with id 0,5,d should be not present in html');
        await checkNoConsoleErrors(driver);
        result = await driver.executeScript(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    resolve(items);
                });
            });
        });
        //check that id 0,5,d exists in the storage
        map = new Map(Object.entries(result));
        assert(!map.has('0,5,d'), 'Dummy with id 0,5,d should not be present in storage');
        assert(!map.get('0').dummies.includes(5), 'Item with id 0 should not have dummyToDelete 5 in dummies array');
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
        assert.strictEqual(children.length, 59, 'Trash popup should have 1 children');

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
        assert.strictEqual(itemAfter.links.length, 9, 'Item 0,1,i should have 10 links in storage');
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
        assert.strictEqual(children.length, 9, 'Item popup should have 10 children');
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
        assert.strictEqual(itemAfter.links.length, 9, 'Item 0,1,i should have 10 links in storage');
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
        await driver.sleep(DEFAULT_SLEEP*3);

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
        assert.strictEqual(map.size, 269, 'There should be no elements in the storage');
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
        //add 100+ links to bookmarks
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
            chrome.bookmarks.create({title: 'Stack Overflow', url: 'https://stackoverflow.com'});
            chrome.bookmarks.create({title: 'GitHub', url: 'https://github.com'});
            chrome.bookmarks.create({title: 'Quora', url: 'https://www.quora.com'});
            chrome.bookmarks.create({title: 'Medium', url: 'https://medium.com'});
            chrome.bookmarks.create({title: 'CNN', url: 'https://www.cnn.com'});
            chrome.bookmarks.create({title: 'BBC', url: 'https://www.bbc.com'});
            chrome.bookmarks.create({title: 'The Verge', url: 'https://www.theverge.com'});
            chrome.bookmarks.create({title: 'NY Times', url: 'https://www.nytimes.com'});
            chrome.bookmarks.create({title: 'Hacker News', url: 'https://news.ycombinator.com'});
            chrome.bookmarks.create({title: 'Product Hunt', url: 'https://www.producthunt.com'});
            chrome.bookmarks.create({title: 'Dribbble', url: 'https://dribbble.com'});
            chrome.bookmarks.create({title: 'Behance', url: 'https://www.behance.net'});
            chrome.bookmarks.create({title: 'Figma', url: 'https://www.figma.com'});
            chrome.bookmarks.create({title: 'Canva', url: 'https://www.canva.com'});
            chrome.bookmarks.create({title: 'Trello', url: 'https://trello.com'});
            chrome.bookmarks.create({title: 'Slack', url: 'https://slack.com'});
            chrome.bookmarks.create({title: 'Discord', url: 'https://discord.com'});
            chrome.bookmarks.create({title: 'Notion', url: 'https://www.notion.so'});
            chrome.bookmarks.create({title: 'Asana', url: 'https://asana.com'});
            chrome.bookmarks.create({title: 'Zoom', url: 'https://zoom.us'});
            chrome.bookmarks.create({title: 'Dropbox', url: 'https://www.dropbox.com'});
            chrome.bookmarks.create({title: 'OneDrive', url: 'https://onedrive.live.com'});
            chrome.bookmarks.create({title: 'Google Drive', url: 'https://drive.google.com'});
            chrome.bookmarks.create({title: 'Evernote', url: 'https://evernote.com'});
            chrome.bookmarks.create({title: 'Coursera', url: 'https://www.coursera.org'});
            chrome.bookmarks.create({title: 'edX', url: 'https://www.edx.org'});
            chrome.bookmarks.create({title: 'Udemy', url: 'https://www.udemy.com'});
            chrome.bookmarks.create({title: 'Khan Academy', url: 'https://www.khanacademy.org'});
            chrome.bookmarks.create({title: 'Codecademy', url: 'https://www.codecademy.com'});
            chrome.bookmarks.create({title: 'LeetCode', url: 'https://leetcode.com'});
            chrome.bookmarks.create({title: 'HackerRank', url: 'https://www.hackerrank.com'});
            chrome.bookmarks.create({title: 'Codewars', url: 'https://www.codewars.com'});
            chrome.bookmarks.create({title: 'FreeCodeCamp', url: 'https://www.freecodecamp.org'});
            chrome.bookmarks.create({title: 'W3Schools', url: 'https://www.w3schools.com'});
            chrome.bookmarks.create({title: 'MDN Web Docs', url: 'https://developer.mozilla.org'});
            chrome.bookmarks.create({title: 'Stack Exchange', url: 'https://stackexchange.com'});
            chrome.bookmarks.create({title: 'Gmail', url: 'https://mail.google.com'});
            chrome.bookmarks.create({title: 'Yahoo Mail', url: 'https://mail.yahoo.com'});
            chrome.bookmarks.create({title: 'Outlook', url: 'https://outlook.live.com'});
            chrome.bookmarks.create({title: 'ProtonMail', url: 'https://proton.me'});
            chrome.bookmarks.create({title: 'Zoho Mail', url: 'https://www.zoho.com/mail/'});
            chrome.bookmarks.create({title: 'Yandex', url: 'https://yandex.com'});
            chrome.bookmarks.create({title: 'Booking', url: 'https://www.booking.com'});
            chrome.bookmarks.create({title: 'Airbnb', url: 'https://www.airbnb.com'});
            chrome.bookmarks.create({title: 'Expedia', url: 'https://www.expedia.com'});
            chrome.bookmarks.create({title: 'TripAdvisor', url: 'https://www.tripadvisor.com'});
            chrome.bookmarks.create({title: 'Hotels', url: 'https://www.hotels.com'});
            chrome.bookmarks.create({title: 'Agoda', url: 'https://www.agoda.com'});
            chrome.bookmarks.create({title: 'Trivago', url: 'https://www.trivago.com'});
            chrome.bookmarks.create({title: 'Kayak', url: 'https://www.kayak.com'});
            chrome.bookmarks.create({title: 'Skyscanner', url: 'https://www.skyscanner.com'});
            chrome.bookmarks.create({title: 'Uber', url: 'https://www.uber.com'});
            chrome.bookmarks.create({title: 'Lyft', url: 'https://www.lyft.com'});
            chrome.bookmarks.create({title: 'Grab', url: 'https://www.grab.com'});
            chrome.bookmarks.create({title: 'DoorDash', url: 'https://www.doordash.com'});
            chrome.bookmarks.create({title: 'Uber Eats', url: 'https://www.ubereats.com'});
            chrome.bookmarks.create({title: 'Grubhub', url: 'https://www.grubhub.com'});
            chrome.bookmarks.create({title: 'Postmates', url: 'https://www.postmates.com'});
            chrome.bookmarks.create({title: 'Just Eat', url: 'https://www.just-eat.com'});
            chrome.bookmarks.create({title: 'Deliveroo', url: 'https://deliveroo.co.uk'});
            chrome.bookmarks.create({title: 'Zomato', url: 'https://www.zomato.com'});
            chrome.bookmarks.create({title: 'OpenTable', url: 'https://www.opentable.com'});
            chrome.bookmarks.create({title: 'Yelp', url: 'https://www.yelp.com'});
            chrome.bookmarks.create({title: 'IMDB', url: 'https://www.imdb.com'});
            chrome.bookmarks.create({title: 'Rotten Tomatoes', url: 'https://www.rottentomatoes.com'});
            chrome.bookmarks.create({title: 'Metacritic', url: 'https://www.metacritic.com'});
            chrome.bookmarks.create({title: 'Goodreads', url: 'https://www.goodreads.com'});
            chrome.bookmarks.create({title: 'SoundCloud', url: 'https://soundcloud.com'});
            chrome.bookmarks.create({title: 'Spotify', url: 'https://www.spotify.com'});
            chrome.bookmarks.create({title: 'Apple Music', url: 'https://music.apple.com'});
            chrome.bookmarks.create({title: 'Deezer', url: 'https://www.deezer.com'});
            chrome.bookmarks.create({title: 'Pandora', url: 'https://www.pandora.com'});
            chrome.bookmarks.create({title: 'Shazam', url: 'https://www.shazam.com'});
            chrome.bookmarks.create({title: 'Bandcamp', url: 'https://bandcamp.com'});
            chrome.bookmarks.create({title: 'Vimeo', url: 'https://vimeo.com'});
            chrome.bookmarks.create({title: 'Dailymotion', url: 'https://www.dailymotion.com'});
            chrome.bookmarks.create({title: 'Twitch', url: 'https://www.twitch.tv'});
            chrome.bookmarks.create({title: 'Kick', url: 'https://kick.com'});
            chrome.bookmarks.create({title: 'Coursera', url: 'https://www.coursera.org'});
            chrome.bookmarks.create({title: 'Udacity', url: 'https://www.udacity.com'});
            chrome.bookmarks.create({title: 'Pluralsight', url: 'https://www.pluralsight.com'});
            chrome.bookmarks.create({title: 'TED', url: 'https://www.ted.com'});
            chrome.bookmarks.create({title: 'National Geographic', url: 'https://www.nationalgeographic.com'});
            chrome.bookmarks.create({title: 'NASA', url: 'https://www.nasa.gov'});
            chrome.bookmarks.create({title: 'Unsplash', url: 'https://unsplash.com'});
            chrome.bookmarks.create({title: 'Pexels', url: 'https://www.pexels.com'});
            chrome.bookmarks.create({title: 'Pixabay', url: 'https://pixabay.com'});
            chrome.bookmarks.create({title: 'GIPHY', url: 'https://giphy.com'});
            chrome.bookmarks.create({title: 'Tenor', url: 'https://tenor.com'});
            chrome.bookmarks.create({title: 'Weather', url: 'https://weather.com'});
            chrome.bookmarks.create({title: 'AccuWeather', url: 'https://www.accuweather.com'});
            chrome.bookmarks.create({title: 'The Weather Channel', url: 'https://weather.com'});
            chrome.bookmarks.create({title: 'Bloomberg', url: 'https://www.bloomberg.com'});
            chrome.bookmarks.create({title: 'Reuters', url: 'https://www.reuters.com'});
            chrome.bookmarks.create({title: 'Forbes', url: 'https://www.forbes.com'});
            chrome.bookmarks.create({title: 'CNBC', url: 'https://www.cnbc.com'});
            chrome.bookmarks.create({title: 'MarketWatch', url: 'https://www.marketwatch.com'});
            chrome.bookmarks.create({title: 'Investopedia', url: 'https://www.investopedia.com'});
            chrome.bookmarks.create({title: 'CoinMarketCap', url: 'https://coinmarketcap.com'});
            chrome.bookmarks.create({title: 'CoinGecko', url: 'https://www.coingecko.com'});
            chrome.bookmarks.create({title: 'TradingView', url: 'https://www.tradingview.com'});
            chrome.bookmarks.create({title: 'Glassdoor', url: 'https://www.glassdoor.com'});
            chrome.bookmarks.create({title: 'Indeed', url: 'https://www.indeed.com'});
            chrome.bookmarks.create({title: 'Monster', url: 'https://www.monster.com'});
            chrome.bookmarks.create({title: 'ZipRecruiter', url: 'https://www.ziprecruiter.com'});
            chrome.bookmarks.create({title: 'AngelList', url: 'https://angel.co'});
            chrome.bookmarks.create({title: 'Crunchbase', url: 'https://www.crunchbase.com'});
        });
        //add 20 links to a reading list
        await driver.executeScript(() => {
            chrome.readingList.addEntry({title: 'Amazon', url: 'https://www.amazon.com',hasBeenRead: false});
            chrome.readingList.addEntry({title: 'eBay', url: 'https://www.ebay.com',hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Gmail', url: 'https://www.gmail.com/',hasBeenRead: false});
        });
        await driver.executeScript(() => {
            chrome.readingList.addEntry({title: 'Amazon', url: 'https://www.amazon.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'eBay', url: 'https://www.ebay.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Gmail', url: 'https://www.gmail.com/', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Google', url: 'https://www.google.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'YouTube', url: 'https://www.youtube.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Facebook', url: 'https://www.facebook.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Wikipedia', url: 'https://www.wikipedia.org', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Instagram', url: 'https://www.instagram.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Baidu', url: 'https://www.baidu.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Yahoo', url: 'https://www.yahoo.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'WhatsApp', url: 'https://www.whatsapp.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Twitter', url: 'https://www.twitter.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'TikTok', url: 'https://www.tiktok.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Reddit', url: 'https://www.reddit.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Bing', url: 'https://www.bing.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'LinkedIn', url: 'https://www.linkedin.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Office', url: 'https://www.office.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Netflix', url: 'https://www.netflix.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'DuckDuckGo', url: 'https://www.duckduckgo.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Pinterest', url: 'https://www.pinterest.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Live', url: 'https://www.live.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Stack Overflow', url: 'https://stackoverflow.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'GitHub', url: 'https://github.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Quora', url: 'https://www.quora.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Medium', url: 'https://medium.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'CNN', url: 'https://www.cnn.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'BBC', url: 'https://www.bbc.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'The Verge', url: 'https://www.theverge.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'NY Times', url: 'https://www.nytimes.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Hacker News', url: 'https://news.ycombinator.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Product Hunt', url: 'https://www.producthunt.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Dribbble', url: 'https://dribbble.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Behance', url: 'https://www.behance.net', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Figma', url: 'https://www.figma.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Canva', url: 'https://www.canva.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Trello', url: 'https://trello.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Slack', url: 'https://slack.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Discord', url: 'https://discord.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Notion', url: 'https://www.notion.so', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Asana', url: 'https://asana.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Zoom', url: 'https://zoom.us', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Dropbox', url: 'https://www.dropbox.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'OneDrive', url: 'https://onedrive.live.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Google Drive', url: 'https://drive.google.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Evernote', url: 'https://evernote.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Coursera', url: 'https://www.coursera.org', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'edX', url: 'https://www.edx.org', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Udemy', url: 'https://www.udemy.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Khan Academy', url: 'https://www.khanacademy.org', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Codecademy', url: 'https://www.codecademy.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'LeetCode', url: 'https://leetcode.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'HackerRank', url: 'https://www.hackerrank.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Codewars', url: 'https://www.codewars.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'FreeCodeCamp', url: 'https://www.freecodecamp.org', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'W3Schools', url: 'https://www.w3schools.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'MDN Web Docs', url: 'https://developer.mozilla.org', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Stack Exchange', url: 'https://stackexchange.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Gmail', url: 'https://mail.google.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Yahoo Mail', url: 'https://mail.yahoo.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Outlook', url: 'https://outlook.live.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'ProtonMail', url: 'https://proton.me', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Zoho Mail', url: 'https://www.zoho.com/mail/', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Yandex', url: 'https://yandex.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Booking', url: 'https://www.booking.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Airbnb', url: 'https://www.airbnb.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Expedia', url: 'https://www.expedia.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'TripAdvisor', url: 'https://www.tripadvisor.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Hotels', url: 'https://www.hotels.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Agoda', url: 'https://www.agoda.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Trivago', url: 'https://www.trivago.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Kayak', url: 'https://www.kayak.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Skyscanner', url: 'https://www.skyscanner.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Uber', url: 'https://www.uber.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Lyft', url: 'https://www.lyft.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Grab', url: 'https://www.grab.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'DoorDash', url: 'https://www.doordash.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Uber Eats', url: 'https://www.ubereats.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Grubhub', url: 'https://www.grubhub.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Postmates', url: 'https://www.postmates.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Just Eat', url: 'https://www.just-eat.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Deliveroo', url: 'https://deliveroo.co.uk', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Zomato', url: 'https://www.zomato.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'OpenTable', url: 'https://www.opentable.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Yelp', url: 'https://www.yelp.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'IMDB', url: 'https://www.imdb.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Rotten Tomatoes', url: 'https://www.rottentomatoes.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Metacritic', url: 'https://www.metacritic.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Goodreads', url: 'https://www.goodreads.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'SoundCloud', url: 'https://soundcloud.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Spotify', url: 'https://www.spotify.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Apple Music', url: 'https://music.apple.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Deezer', url: 'https://www.deezer.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Pandora', url: 'https://www.pandora.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Shazam', url: 'https://www.shazam.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Bandcamp', url: 'https://bandcamp.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Vimeo', url: 'https://vimeo.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Dailymotion', url: 'https://www.dailymotion.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Twitch', url: 'https://www.twitch.tv', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Kick', url: 'https://kick.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'TED', url: 'https://www.ted.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'National Geographic', url: 'https://www.nationalgeographic.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'NASA', url: 'https://www.nasa.gov', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Unsplash', url: 'https://unsplash.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Pexels', url: 'https://www.pexels.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Pixabay', url: 'https://pixabay.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'GIPHY', url: 'https://giphy.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Tenor', url: 'https://tenor.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Weather', url: 'https://weather.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'AccuWeather', url: 'https://www.accuweather.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Bloomberg', url: 'https://www.bloomberg.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Reuters', url: 'https://www.reuters.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Forbes', url: 'https://www.forbes.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'CNBC', url: 'https://www.cnbc.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'MarketWatch', url: 'https://www.marketwatch.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Investopedia', url: 'https://www.investopedia.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'CoinMarketCap', url: 'https://coinmarketcap.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'CoinGecko', url: 'https://www.coingecko.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'TradingView', url: 'https://www.tradingview.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Glassdoor', url: 'https://www.glassdoor.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Indeed', url: 'https://www.indeed.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Monster', url: 'https://www.monster.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'ZipRecruiter', url: 'https://www.ziprecruiter.com', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'AngelList', url: 'https://angel.co', hasBeenRead: false});
            chrome.readingList.addEntry({title: 'Crunchbase', url: 'https://www.crunchbase.com', hasBeenRead: false});
        });
        //add 100+ links to a history
        await driver.executeScript(() => {
            chrome.history.addUrl({url: 'https://www.google.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.youtube.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.facebook.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.wikipedia.org'}, () => {});
            chrome.history.addUrl({url: 'https://www.instagram.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.baidu.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.yahoo.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.whatsapp.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.twitter.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.amazon.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.tiktok.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.reddit.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.bing.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.linkedin.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.office.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.netflix.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.duckduckgo.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.pinterest.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.live.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.ebay.com'}, () => {});
            chrome.history.addUrl({url: 'https://stackoverflow.com'}, () => {});
            chrome.history.addUrl({url: 'https://github.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.quora.com'}, () => {});
            chrome.history.addUrl({url: 'https://medium.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.cnn.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.bbc.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.theverge.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.nytimes.com'}, () => {});
            chrome.history.addUrl({url: 'https://news.ycombinator.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.producthunt.com'}, () => {});
            chrome.history.addUrl({url: 'https://dribbble.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.behance.net'}, () => {});
            chrome.history.addUrl({url: 'https://www.figma.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.canva.com'}, () => {});
            chrome.history.addUrl({url: 'https://trello.com'}, () => {});
            chrome.history.addUrl({url: 'https://slack.com'}, () => {});
            chrome.history.addUrl({url: 'https://discord.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.notion.so'}, () => {});
            chrome.history.addUrl({url: 'https://asana.com'}, () => {});
            chrome.history.addUrl({url: 'https://zoom.us'}, () => {});
            chrome.history.addUrl({url: 'https://www.dropbox.com'}, () => {});
            chrome.history.addUrl({url: 'https://onedrive.live.com'}, () => {});
            chrome.history.addUrl({url: 'https://drive.google.com'}, () => {});
            chrome.history.addUrl({url: 'https://evernote.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.coursera.org'}, () => {});
            chrome.history.addUrl({url: 'https://www.edx.org'}, () => {});
            chrome.history.addUrl({url: 'https://www.udemy.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.khanacademy.org'}, () => {});
            chrome.history.addUrl({url: 'https://www.codecademy.com'}, () => {});
            chrome.history.addUrl({url: 'https://leetcode.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.hackerrank.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.codewars.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.freecodecamp.org'}, () => {});
            chrome.history.addUrl({url: 'https://www.w3schools.com'}, () => {});
            chrome.history.addUrl({url: 'https://developer.mozilla.org'}, () => {});
            chrome.history.addUrl({url: 'https://stackexchange.com'}, () => {});
            chrome.history.addUrl({url: 'https://mail.google.com'}, () => {});
            chrome.history.addUrl({url: 'https://mail.yahoo.com'}, () => {});
            chrome.history.addUrl({url: 'https://outlook.live.com'}, () => {});
            chrome.history.addUrl({url: 'https://proton.me'}, () => {});
            chrome.history.addUrl({url: 'https://www.zoho.com/mail/'}, () => {});
            chrome.history.addUrl({url: 'https://yandex.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.booking.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.airbnb.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.expedia.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.tripadvisor.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.hotels.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.agoda.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.trivago.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.kayak.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.skyscanner.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.uber.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.lyft.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.grab.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.doordash.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.ubereats.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.grubhub.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.postmates.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.just-eat.com'}, () => {});
            chrome.history.addUrl({url: 'https://deliveroo.co.uk'}, () => {});
            chrome.history.addUrl({url: 'https://www.zomato.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.opentable.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.yelp.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.imdb.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.rottentomatoes.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.metacritic.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.goodreads.com'}, () => {});
            chrome.history.addUrl({url: 'https://soundcloud.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.spotify.com'}, () => {});
            chrome.history.addUrl({url: 'https://music.apple.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.deezer.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.pandora.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.shazam.com'}, () => {});
            chrome.history.addUrl({url: 'https://bandcamp.com'}, () => {});
            chrome.history.addUrl({url: 'https://vimeo.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.dailymotion.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.twitch.tv'}, () => {});
            chrome.history.addUrl({url: 'https://kick.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.udacity.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.pluralsight.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.ted.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.nationalgeographic.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.nasa.gov'}, () => {});
            chrome.history.addUrl({url: 'https://unsplash.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.pexels.com'}, () => {});
            chrome.history.addUrl({url: 'https://pixabay.com'}, () => {});
            chrome.history.addUrl({url: 'https://giphy.com'}, () => {});
            chrome.history.addUrl({url: 'https://tenor.com'}, () => {});
            chrome.history.addUrl({url: 'https://weather.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.accuweather.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.bloomberg.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.reuters.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.forbes.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.cnbc.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.marketwatch.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.investopedia.com'}, () => {});
            chrome.history.addUrl({url: 'https://coinmarketcap.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.coingecko.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.tradingview.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.glassdoor.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.indeed.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.monster.com'}, () => {});
            chrome.history.addUrl({url: 'https://www.ziprecruiter.com'}, () => {});
            chrome.history.addUrl({url: 'https://angel.co'}, () => {});
            chrome.history.addUrl({url: 'https://www.crunchbase.com'}, () => {});
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
                        "dummies": [
                            0
                        ],
                        "id": "0",
                        "items": [
                            0,
                            1,
                            2,
                            3
                        ],
                        "stations": [
                            0,
                            1,
                            2,
                            4,
                            5,
                            6
                        ]
                    },
                    "1": {
                        "background": "images/living-room-animation.jpg",
                        "dummies": [],
                        "id": "1",
                        "items": [
                            0,
                            1,
                            2
                        ],
                        "parent": "0",
                        "stations": []
                    },
                    "2": {
                        "background": "https://weadesign.com/wp-content/uploads/2024/02/apartment-interior-design.webp",
                        "dummies": [],
                        "id": "2",
                        "items": [
                            0,
                            1
                        ],
                        "parent": "0",
                        "stations": [
                            0,
                            1,
                            2
                        ]
                    },
                    "3": {
                        "background": "https://media.designcafe.com/wp-content/uploads/2022/03/04164440/pink-girl-bedroom-design-ideas.jpg",
                        "dummies": [],
                        "id": "3",
                        "items": [
                            0,
                            1
                        ],
                        "parent": "2",
                        "stations": []
                    },
                    "4": {
                        "background": "https://image.cdn2.seaart.me/2023-05-31/29331243397189/5da67a4a7c11a9aa0c5539acf26e3ffd80b93cce_high.webp",
                        "dummies": [],
                        "id": "4",
                        "items": [
                            0,
                            1,
                            2
                        ],
                        "parent": "0",
                        "stations": []
                    },
                    "5": {
                        "background": "https://pbs.twimg.com/media/FSunEp_WUAMKYhB.jpg:large",
                        "dummies": [],
                        "id": "5",
                        "items": [],
                        "parent": "0",
                        "stations": []
                    },
                    "6": {
                        "background": "https://wallpapers.com/images/hd/modern-office-background-1920-x-1200-3u7w0j7r25g1rh55.jpg",
                        "dummies": [
                            0,
                            1,
                            2
                        ],
                        "id": "6",
                        "items": [
                            0,
                            1,
                            2,
                            3,
                            4,
                            6,
                            7,
                            8
                        ],
                        "parent": "2",
                        "stations": []
                    },
                    "7": {
                        "background": "https://static.vecteezy.com/system/resources/previews/016/962/027/non_2x/kids-bedroom-with-bed-table-toys-and-wardrobe-free-vector.jpg",
                        "dummies": [],
                        "id": "7",
                        "items": [
                            0,
                            1,
                            2,
                            3
                        ],
                        "parent": "2",
                        "stations": []
                    },
                    "8": {
                        "background": "https://pbs.twimg.com/media/FSunEp_WUAMKYhB.jpg:large",
                        "dummies": [],
                        "id": "8",
                        "items": [
                            0
                        ],
                        "parent": "0",
                        "stations": []
                    },
                    "9": {
                        "background": "https://muralsyourway.vtexassets.com/arquivos/ids/257115/Travel-The-World-Map-Wallpaper-Mural.jpg?v=638164887221970000",
                        "dummies": [],
                        "id": "9",
                        "items": [
                            0,
                            1,
                            2
                        ],
                        "parent": "0",
                        "stations": []
                    },
                    "10": {
                        "background": "https://d7hftxdivxxvm.cloudfront.net/?height=900&quality=80&resize_to=fill&src=https%3A%2F%2Fartsy-media-uploads.s3.amazonaws.com%2F2P6t_Yt6dF0TNN76dlp-_Q%252F3417757448_4a6bdf36ce_o.jpg&width=1200",
                        "dummies": [],
                        "id": "10",
                        "items": [
                            0,
                            1,
                            2,
                            3
                        ],
                        "parent": "0",
                        "stations": [
                            0
                        ]
                    },
                    "11": {
                        "background": "images/living-room-animation.jpg",
                        "dummies": [],
                        "id": "11",
                        "items": [],
                        "parent": "10",
                        "stations": []
                    },
                    "0,0,d": {
                        "height": "48px",
                        "icon": "https://i.pinimg.com/originals/e2/bc/82/e2bc8260173e1dbe01ba2b8b8f1a2d31.gif",
                        "id": "0,0,d",
                        "left": "1347px",
                        "title": "Birds",
                        "top": "199px",
                        "type": "dummy",
                        "view": "0",
                        "width": "61px"
                    },
                    "0,0,i": {
                        "faviconChrome": "false",
                        "height": "64px",
                        "icon": "https://i.pinimg.com/originals/04/c4/a8/04c4a8baf0068b244bed7b7df509898f.gif",
                        "id": "0,0,i",
                        "left": "1102px",
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
                            10
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
                    "0,0,i,10": {
                        "faviconChrome": "false",
                        "icon": "https://www.linkedin.com/",
                        "id": "0,0,i,10",
                        "link": "https://www.linkedin.com/",
                        "title": "LinkedIn",
                        "view": "0"
                    },
                    "0,0,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://www.amazon.com/",
                        "id": "0,0,i,2",
                        "link": "https://www.amazon.com/",
                        "title": "Amazon",
                        "view": "0"
                    },
                    "0,0,i,3": {
                        "faviconChrome": "false",
                        "icon": "https://www.amazon.com/",
                        "id": "0,0,i,3",
                        "link": "https://www.amazon.com/",
                        "title": "Amazon",
                        "view": "0"
                    },
                    "0,0,i,4": {
                        "faviconChrome": "false",
                        "icon": "https://www.instagram.com/",
                        "id": "0,0,i,4",
                        "link": "https://www.instagram.com/",
                        "title": "Instagram",
                        "view": "0"
                    },
                    "0,0,i,5": {
                        "faviconChrome": "false",
                        "icon": "https://www.instagram.com/",
                        "id": "0,0,i,5",
                        "link": "https://www.instagram.com/",
                        "title": "Instagram",
                        "view": "0"
                    },
                    "0,0,i,6": {
                        "faviconChrome": "false",
                        "icon": "https://www.youtube.com/",
                        "id": "0,0,i,6",
                        "link": "https://www.youtube.com/",
                        "title": "YouTube",
                        "view": "0"
                    },
                    "0,0,i,7": {
                        "faviconChrome": "false",
                        "icon": "https://www.ebay.com/",
                        "id": "0,0,i,7",
                        "link": "https://www.ebay.com/",
                        "title": "Electronics, Cars, Fashion, Collectibles & More | eBay",
                        "view": "0"
                    },
                    "0,0,i,8": {
                        "faviconChrome": "false",
                        "icon": "https://www.pinterest.com/",
                        "id": "0,0,i,8",
                        "link": "https://www.pinterest.com/",
                        "title": "Pinterest",
                        "view": "0"
                    },
                    "0,0,i,9": {
                        "faviconChrome": "false",
                        "icon": "https://www.netflix.com/",
                        "id": "0,0,i,9",
                        "link": "https://www.netflix.com/",
                        "title": "Netflix",
                        "view": "0"
                    },
                    "0,0,s": {
                        "height": "114px",
                        "icon": "https://i.pinimg.com/originals/1d/fd/00/1dfd007c6a813a29c736f2cb4f8641e5.gif",
                        "id": "0,0,s",
                        "left": "951px",
                        "target": 1,
                        "title": "Apartment",
                        "top": "480px",
                        "type": "station",
                        "view": "0",
                        "width": "76px"
                    },
                    "0,1,i": {
                        "faviconChrome": "false",
                        "height": "109px",
                        "icon": "https://media.baamboozle.com/uploads/images/323666/1624532385_171205_gif-url.gif",
                        "id": "0,1,i",
                        "left": "1175px",
                        "links": [
                            0,
                            1,
                            2,
                            3,
                            4,
                            5,
                            6,
                            7,
                            8
                        ],
                        "title": "Shopping",
                        "top": "510px",
                        "type": "item",
                        "view": "0",
                        "width": "87px"
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
                    "0,1,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://www.reddit.com/",
                        "id": "0,1,i,2",
                        "link": "https://www.reddit.com/",
                        "title": "Reddit",
                        "view": "0"
                    },
                    "0,1,i,3": {
                        "faviconChrome": "false",
                        "icon": "https://www.amazon.com/",
                        "id": "0,1,i,3",
                        "link": "https://www.amazon.com/",
                        "title": "Amazon",
                        "view": "0"
                    },
                    "0,1,i,4": {
                        "faviconChrome": "false",
                        "icon": "https://www.wikipedia.org/",
                        "id": "0,1,i,4",
                        "link": "https://www.wikipedia.org/",
                        "title": "Wikipedia",
                        "view": "0"
                    },
                    "0,1,i,5": {
                        "faviconChrome": "false",
                        "icon": "https://workspace.google.com/intl/en-US/gmail/",
                        "id": "0,1,i,5",
                        "link": "https://workspace.google.com/intl/en-US/gmail/",
                        "title": "Gmail: Private and secure email at no cost | Google Workspace",
                        "view": "0"
                    },
                    "0,1,i,6": {
                        "faviconChrome": "false",
                        "icon": "https://www.facebook.com/",
                        "id": "0,1,i,6",
                        "link": "https://www.facebook.com/",
                        "title": "Facebook",
                        "view": "0"
                    },
                    "0,1,i,7": {
                        "faviconChrome": "false",
                        "icon": "https://www.youtube.com/",
                        "id": "0,1,i,7",
                        "link": "https://www.youtube.com/",
                        "title": "YouTube",
                        "view": "0"
                    },
                    "0,1,i,8": {
                        "faviconChrome": "false",
                        "icon": "file:///C:/Users/User/Downloads/sample-local-pdf.pdf",
                        "id": "0,1,i,8",
                        "link": "file:///C:/Users/User/Downloads/sample-local-pdf.pdf",
                        "title": "Sample PDF",
                        "view": "0"
                    },
                    "0,1,s": {
                        "height": "376px",
                        "icon": "https://mir-s3-cdn-cf.behance.net/project_modules/source/ba467372969113.5bf9ecdda7cfb.gif",
                        "id": "0,1,s",
                        "left": "22px",
                        "target": 2,
                        "title": "New apartment",
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
                        "left": "392px",
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
                            9
                        ],
                        "title": "Cats movie",
                        "top": "610px",
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
                    "0,2,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.gmail.com/",
                        "id": "0,2,i,1",
                        "link": "https://www.gmail.com/",
                        "title": "Gmail",
                        "view": "0"
                    },
                    "0,2,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://www.ebay.com/",
                        "id": "0,2,i,2",
                        "link": "https://www.ebay.com/",
                        "title": "eBay",
                        "view": "0"
                    },
                    "0,2,i,3": {
                        "faviconChrome": "false",
                        "icon": "https://www.reddit.com/",
                        "id": "0,2,i,3",
                        "link": "https://www.reddit.com/",
                        "title": "Reddit",
                        "view": "0"
                    },
                    "0,2,i,4": {
                        "faviconChrome": "false",
                        "icon": "https://www.baidu.com/",
                        "id": "0,2,i,4",
                        "link": "https://www.baidu.com/",
                        "title": "Baidu",
                        "view": "0"
                    },
                    "0,2,i,5": {
                        "faviconChrome": "false",
                        "icon": "https://www.gmail.com/",
                        "id": "0,2,i,5",
                        "link": "https://www.gmail.com/",
                        "title": "Gmail",
                        "view": "0"
                    },
                    "0,2,i,6": {
                        "faviconChrome": "false",
                        "icon": "https://www.google.com/sorry/index?continue=https://www.google.com/search%3Fq%3Dbooks%2Banimated%2Bgif%26sei%3Dcym8aMIf2azFzw_isobABA&q=EgRfW_FgGPPS8MUGIjC1iV_D79j4eY-RRtrDTv4qlUySsNYSMquIOUF1BgCcSJoGAPcZryldtT07EcKgDZYyAVJaAUM",
                        "id": "0,2,i,6",
                        "link": "https://www.google.com/sorry/index?continue=https://www.google.com/search%3Fq%3Dbooks%2Banimated%2Bgif%26sei%3Dcym8aMIf2azFzw_isobABA&q=EgRfW_FgGPPS8MUGIjC1iV_D79j4eY-RRtrDTv4qlUySsNYSMquIOUF1BgCcSJoGAPcZryldtT07EcKgDZYyAVJaAUM",
                        "title": "https://www.google.com/search?q=books+animated+gif&sei=cym8aMIf2azFzw_isobABA",
                        "view": "0"
                    },
                    "0,2,i,7": {
                        "faviconChrome": "false",
                        "icon": "https://www.amazon.com/",
                        "id": "0,2,i,7",
                        "link": "https://www.amazon.com/",
                        "title": "Amazon.com",
                        "view": "0"
                    },
                    "0,2,i,8": {
                        "faviconChrome": "false",
                        "icon": "https://www.bing.com/",
                        "id": "0,2,i,8",
                        "link": "https://www.bing.com/",
                        "title": "Bing",
                        "view": "0"
                    },
                    "0,2,i,9": {
                        "faviconChrome": "false",
                        "icon": "https://www.reddit.com/",
                        "id": "0,2,i,9",
                        "link": "https://www.reddit.com/",
                        "title": "Reddit",
                        "view": "0"
                    },
                    "0,2,s": {
                        "height": "149px",
                        "icon": "https://i.redd.it/qzkpthkpayz51.gif",
                        "id": "0,2,s",
                        "left": "1795px",
                        "target": 4,
                        "title": "Another View",
                        "top": "286px",
                        "type": "station",
                        "view": "0",
                        "width": "115px"
                    },
                    "0,3,i": {
                        "faviconChrome": "false",
                        "height": "64px",
                        "icon": "https://media1.giphy.com/media/v1.Y2lkPTZjMDliOTUyN295YTI1cWY5d2Vrc3g1MmdyYjgxOTZmbjA0NDhvNjM2aHlrNDh3NiZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/yyJtlSsn2cP8WH1Drv/giphy.gif",
                        "id": "0,3,i",
                        "left": "41px",
                        "links": [
                            0,
                            1,
                            2
                        ],
                        "title": "Gym",
                        "top": "486px",
                        "type": "item",
                        "view": "0",
                        "width": "64px"
                    },
                    "0,3,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://www.greengymberlin.de/",
                        "id": "0,3,i,0",
                        "link": "https://www.greengymberlin.de/",
                        "title": "https://www.greengymberlin.de/",
                        "view": "0"
                    },
                    "0,3,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.youtube.com/",
                        "id": "0,3,i,1",
                        "link": "https://www.youtube.com/",
                        "title": "YouTube",
                        "view": "0"
                    },
                    "0,3,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://dribbble.com/",
                        "id": "0,3,i,2",
                        "link": "https://dribbble.com/",
                        "title": "Dribbble",
                        "view": "0"
                    },
                    "0,4,s": {
                        "height": "312px",
                        "icon": "https://giffiles.alphacoders.com/394/39410.gif",
                        "id": "0,4,s",
                        "left": "1492px",
                        "target": 8,
                        "title": "Car",
                        "top": "464px",
                        "type": "station",
                        "view": "0",
                        "width": "374px",
                        "zIndex": "2"
                    },
                    "0,5,s": {
                        "height": "93px",
                        "icon": "https://media0.giphy.com/media/v1.Y2lkPTZjMDliOTUyajh1cHJzMmZlZDZtaDN1cm1iYjU1ZWZzcGdpd2t3MWVsbGpoa3hwcyZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/qH15RNEtCR9FAyR8iu/giphy.gif",
                        "id": "0,5,s",
                        "left": "624px",
                        "target": 9,
                        "title": "Travel",
                        "top": "51px",
                        "type": "station",
                        "view": "0",
                        "width": "98px"
                    },
                    "0,6,s": {
                        "height": "51px",
                        "icon": "https://moein.video/wp-content/uploads/2022/10/arrow-Free-Animated-Icon-GIF-1080p-after-effects.gif",
                        "id": "0,6,s",
                        "left": "1802px",
                        "target": 10,
                        "title": "Windows",
                        "top": "50px",
                        "type": "station",
                        "view": "0",
                        "width": "51px"
                    },
                    "1,0,i": {
                        "faviconChrome": "false",
                        "height": "64px",
                        "icon": "https://bookscador-pi.vercel.app/_next/image?url=https%3A%2F%2Fres.cloudinary.com%2Fknowhere%2Fimage%2Fupload%2Fv1667690640%2FBookscador%2Fstatic%2Fbooks-gif-unscreen_xvsiyu.gif&w=640&q=75",
                        "id": "1,0,i",
                        "left": "1387px",
                        "links": [
                            0,
                            1,
                            2
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
                    "1,0,i,2": {
                        "faviconChrome": "false",
                        "icon": "file:///C:/Users/User/Downloads/sample-local-pdf.pdf",
                        "id": "1,0,i,2",
                        "link": "file:///C:/Users/User/Downloads/sample-local-pdf.pdf",
                        "title": "Sample PDF",
                        "view": "1"
                    },
                    "1,1,i": {
                        "faviconChrome": "false",
                        "height": "103px",
                        "icon": "https://media1.giphy.com/media/v1.Y2lkPTZjMDliOTUyeHVnYWk3NmV3NnNlYWI3a2dpcW1iZmttZ3pxajF4N29zMjhzNGR5ZiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3o6wrEISO16bXgL7B6/giphy.gif",
                        "id": "1,1,i",
                        "left": "1319px",
                        "links": [
                            0,
                            1,
                            2
                        ],
                        "title": "Movies",
                        "top": "532px",
                        "type": "item",
                        "view": "1",
                        "width": "231px"
                    },
                    "1,1,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://www.netflix.com/",
                        "id": "1,1,i,0",
                        "link": "https://www.netflix.com/",
                        "title": "Netflix",
                        "view": "1"
                    },
                    "1,1,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.amazon.com/",
                        "id": "1,1,i,1",
                        "link": "https://www.amazon.com/",
                        "title": "Amazon",
                        "view": "1"
                    },
                    "1,1,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://www.youtube.com/",
                        "id": "1,1,i,2",
                        "link": "https://www.youtube.com/",
                        "title": "YouTube",
                        "view": "1"
                    },
                    "1,2,i": {
                        "faviconChrome": "false",
                        "height": "149px",
                        "icon": "https://media1.giphy.com/media/pzvUEkOeAViy7VS7B6/giphy.gif?cid=a267dfa3zrvx7z6zqh6d4srv0tsguno52jry58ol8qn13thl&rid=giphy.gif&ct=s",
                        "id": "1,2,i",
                        "left": "135px",
                        "links": [
                            0,
                            1,
                            2,
                            3
                        ],
                        "title": "Todo",
                        "top": "740px",
                        "type": "item",
                        "view": "1",
                        "width": "176px"
                    },
                    "1,2,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://www.facebook.com/",
                        "id": "1,2,i,0",
                        "link": "https://www.facebook.com/",
                        "title": "Facebook",
                        "view": "1"
                    },
                    "1,2,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://angel.co/",
                        "id": "1,2,i,1",
                        "link": "https://angel.co/",
                        "title": "AngelList",
                        "view": "1"
                    },
                    "1,2,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://www.glassdoor.com/",
                        "id": "1,2,i,2",
                        "link": "https://www.glassdoor.com/",
                        "title": "Glassdoor",
                        "view": "1"
                    },
                    "1,2,i,3": {
                        "faviconChrome": "false",
                        "icon": "https://music.apple.com/",
                        "id": "1,2,i,3",
                        "link": "https://music.apple.com/",
                        "title": "Apple Music",
                        "view": "1"
                    },
                    "10,0,i": {
                        "faviconChrome": "false",
                        "height": "64px",
                        "icon": "https://www.iconpacks.net/icons/2/free-folder-icon-1484-thumb.png",
                        "id": "10,0,i",
                        "left": "98px",
                        "links": [
                            0,
                            1,
                            2,
                            3
                        ],
                        "title": "Folder",
                        "top": "265px",
                        "type": "item",
                        "view": "10",
                        "width": "64px"
                    },
                    "10,0,i,0": {
                        "faviconChrome": "false",
                        "icon": "file:///C:/Users/User/Downloads/sample-local-pdf.pdf",
                        "id": "10,0,i,0",
                        "link": "file:///C:/Users/User/Downloads/sample-local-pdf.pdf",
                        "title": "Sample PDF",
                        "view": "10"
                    },
                    "10,0,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.wikipedia.org/",
                        "id": "10,0,i,1",
                        "link": "https://www.wikipedia.org/",
                        "title": "Wikipedia",
                        "view": "10"
                    },
                    "10,0,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://www.twitch.tv/",
                        "id": "10,0,i,2",
                        "link": "https://www.twitch.tv/",
                        "title": "Twitch",
                        "view": "10"
                    },
                    "10,0,i,3": {
                        "faviconChrome": "false",
                        "icon": "https://www.booking.com/",
                        "id": "10,0,i,3",
                        "link": "https://www.booking.com/",
                        "title": "Booking",
                        "view": "10"
                    },
                    "10,0,s": {
                        "height": "64px",
                        "icon": "https://cdn-icons-png.flaticon.com/512/4703/4703650.png",
                        "id": "10,0,s",
                        "left": "17px",
                        "target": 11,
                        "title": "PC",
                        "top": "69px",
                        "type": "station",
                        "view": "10",
                        "width": "64px"
                    },
                    "10,1,i": {
                        "faviconChrome": "false",
                        "height": "64px",
                        "icon": "https://www.iconpacks.net/icons/2/free-folder-icon-1484-thumb.png",
                        "id": "10,1,i",
                        "left": "91px",
                        "links": [
                            0,
                            1,
                            2
                        ],
                        "title": "Folder2",
                        "top": "444px",
                        "type": "item",
                        "view": "10",
                        "width": "64px"
                    },
                    "10,1,i,0": {
                        "faviconChrome": "false",
                        "icon": "file:///C:/Users/User/Downloads/sample-local-pdf.pdf",
                        "id": "10,1,i,0",
                        "link": "file:///C:/Users/User/Downloads/sample-local-pdf.pdf",
                        "title": "Sample PDF",
                        "view": "10"
                    },
                    "10,1,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.expedia.com/",
                        "id": "10,1,i,1",
                        "link": "https://www.expedia.com/",
                        "title": "Expedia",
                        "view": "10"
                    },
                    "10,1,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://www.crunchbase.com/",
                        "id": "10,1,i,2",
                        "link": "https://www.crunchbase.com/",
                        "title": "Crunchbase",
                        "view": "10"
                    },
                    "10,2,i": {
                        "faviconChrome": "false",
                        "height": "64px",
                        "icon": "https://www.iconpacks.net/icons/2/free-folder-icon-1484-thumb.png",
                        "id": "10,2,i",
                        "left": "23px",
                        "links": [],
                        "title": "Folder3",
                        "top": "587px",
                        "type": "item",
                        "view": "10",
                        "width": "64px"
                    },
                    "10,3,i": {
                        "faviconChrome": "false",
                        "height": "64px",
                        "icon": "https://www.iconpacks.net/icons/2/free-folder-icon-1484-thumb.png",
                        "id": "10,3,i",
                        "left": "30px",
                        "links": [],
                        "title": "Folder4",
                        "top": "695px",
                        "type": "item",
                        "view": "10",
                        "width": "64px"
                    },
                    "2,0,i": {
                        "faviconChrome": "false",
                        "height": "86px",
                        "icon": "https://s3.eu-west-2.amazonaws.com/farming-foodsteps/images/MENU/lesson4.gif",
                        "id": "2,0,i",
                        "left": "80px",
                        "links": [
                            0,
                            1,
                            2,
                            3
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
                    "2,0,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.reddit.com/",
                        "id": "2,0,i,1",
                        "link": "https://www.reddit.com/",
                        "title": "Reddit",
                        "view": "2"
                    },
                    "2,0,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://www.just-eat.com/",
                        "id": "2,0,i,2",
                        "link": "https://www.just-eat.com/",
                        "title": "Just Eat",
                        "view": "2"
                    },
                    "2,0,i,3": {
                        "faviconChrome": "false",
                        "icon": "https://deliveroo.co.uk/",
                        "id": "2,0,i,3",
                        "link": "https://deliveroo.co.uk/",
                        "title": "Deliveroo",
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
                    "2,1,i": {
                        "faviconChrome": "false",
                        "height": "139px",
                        "icon": "https://i.pinimg.com/originals/82/28/2c/82282cde0b4d73445967aea7f761bda9.gif",
                        "id": "2,1,i",
                        "left": "688px",
                        "links": [
                            0,
                            1,
                            2
                        ],
                        "title": "Cooking",
                        "top": "448px",
                        "type": "item",
                        "view": "2",
                        "width": "153px"
                    },
                    "2,1,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://www.yahoo.com/",
                        "id": "2,1,i,0",
                        "link": "https://www.yahoo.com/",
                        "title": "Yahoo",
                        "view": "2"
                    },
                    "2,1,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.behance.net/",
                        "id": "2,1,i,1",
                        "link": "https://www.behance.net/",
                        "title": "Behance",
                        "view": "2"
                    },
                    "2,1,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://www.facebook.com/",
                        "id": "2,1,i,2",
                        "link": "https://www.facebook.com/",
                        "title": "Facebook",
                        "view": "2"
                    },
                    "2,1,s": {
                        "height": "44px",
                        "icon": "https://media.tenor.com/rvDQSe2TtvwAAAAj/community-office.gif",
                        "id": "2,1,s",
                        "left": "1201px",
                        "target": 6,
                        "title": "Office",
                        "top": "511px",
                        "type": "station",
                        "view": "2",
                        "width": "46px"
                    },
                    "2,2,s": {
                        "height": "279px",
                        "icon": "https://i.pinimg.com/originals/77/76/a6/7776a6af7e14e46ae609b5ee03c6037a.gif",
                        "id": "2,2,s",
                        "left": "349px",
                        "target": 7,
                        "title": "Son",
                        "top": "601px",
                        "type": "station",
                        "view": "2",
                        "width": "161px"
                    },
                    "3,0,i": {
                        "faviconChrome": "false",
                        "height": "73px",
                        "icon": "https://cdnfiles.j2bloggy.com/9846_b/wp-content/uploads/sites/342/2021/09/homework-gif.gif",
                        "id": "3,0,i",
                        "left": "542px",
                        "links": [
                            0,
                            1
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
                    "3,0,i,1": {
                        "faviconChrome": "false",
                        "icon": "file:///C:/Users/User/Downloads/sample-local-pdf.pdf",
                        "id": "3,0,i,1",
                        "link": "file:///C:/Users/User/Downloads/sample-local-pdf.pdf",
                        "title": "Sample PDF",
                        "view": "3"
                    },
                    "3,1,i": {
                        "faviconChrome": "false",
                        "height": "57px",
                        "icon": "https://cdnl.iconscout.com/lottie/premium/thumb/going-to-school-animated-sticker-gif-download-8426879.gif",
                        "id": "3,1,i",
                        "left": "359px",
                        "links": [
                            0,
                            1,
                            2,
                            3,
                            4,
                            5
                        ],
                        "title": "School",
                        "top": "222px",
                        "type": "item",
                        "view": "3",
                        "width": "59px"
                    },
                    "3,1,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://www.skyscanner.com/",
                        "id": "3,1,i,0",
                        "link": "https://www.skyscanner.com/",
                        "title": "",
                        "view": "3"
                    },
                    "3,1,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://drive.google.com/",
                        "id": "3,1,i,1",
                        "link": "https://drive.google.com/",
                        "title": "",
                        "view": "3"
                    },
                    "3,1,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://evernote.com/",
                        "id": "3,1,i,2",
                        "link": "https://evernote.com/",
                        "title": "",
                        "view": "3"
                    },
                    "3,1,i,3": {
                        "faviconChrome": "false",
                        "icon": "https://www.hotels.com/",
                        "id": "3,1,i,3",
                        "link": "https://www.hotels.com/",
                        "title": "",
                        "view": "3"
                    },
                    "3,1,i,4": {
                        "faviconChrome": "false",
                        "icon": "https://www.tripadvisor.com/",
                        "id": "3,1,i,4",
                        "link": "https://www.tripadvisor.com/",
                        "title": "",
                        "view": "3"
                    },
                    "3,1,i,5": {
                        "faviconChrome": "false",
                        "icon": "https://www.shazam.com/",
                        "id": "3,1,i,5",
                        "link": "https://www.shazam.com/",
                        "title": "",
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
                    "4,1,i": {
                        "faviconChrome": "false",
                        "height": "123px",
                        "icon": "https://gifgifs.com/animations/anime/dragon-ball-z/Goku/goku_70.gif",
                        "id": "4,1,i",
                        "left": "1224px",
                        "links": [
                            0,
                            1,
                            2
                        ],
                        "title": "Games",
                        "top": "512px",
                        "type": "item",
                        "view": "4",
                        "width": "90px"
                    },
                    "4,1,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://discord.com/",
                        "id": "4,1,i,0",
                        "link": "https://discord.com/",
                        "title": "Discord",
                        "view": "4"
                    },
                    "4,1,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.coingecko.com/",
                        "id": "4,1,i,1",
                        "link": "https://www.coingecko.com/",
                        "title": "CoinGecko",
                        "view": "4"
                    },
                    "4,1,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://www.ziprecruiter.com/",
                        "id": "4,1,i,2",
                        "link": "https://www.ziprecruiter.com/",
                        "title": "ZipRecruiter",
                        "view": "4"
                    },
                    "4,2,i": {
                        "faviconChrome": "false",
                        "height": "81px",
                        "icon": "https://pa1.aminoapps.com/5580/61d47e8474e24ac4cb98fc673ab1c589c38aa961_hq.gif",
                        "id": "4,2,i",
                        "left": "597px",
                        "links": [
                            0,
                            1,
                            2
                        ],
                        "title": "Games new",
                        "top": "595px",
                        "type": "item",
                        "view": "4",
                        "width": "279px"
                    },
                    "4,2,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://discord.com/",
                        "id": "4,2,i,0",
                        "link": "https://discord.com/",
                        "title": "Discord",
                        "view": "4"
                    },
                    "4,2,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.metacritic.com/",
                        "id": "4,2,i,1",
                        "link": "https://www.metacritic.com/",
                        "title": "Metacritic",
                        "view": "4"
                    },
                    "4,2,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://www.airbnb.com/",
                        "id": "4,2,i,2",
                        "link": "https://www.airbnb.com/",
                        "title": "Airbnb",
                        "view": "4"
                    },
                    "6,0,d": {
                        "height": "64px",
                        "icon": "https://media0.giphy.com/media/v1.Y2lkPTZjMDliOTUybWtwM3R2MmQxNTYxYml2bmJ2MXU3ZHd5bDU5eDlvYW83azY2ODQ0MCZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/gmSQYMDoRrwq06SSCu/source.gif",
                        "id": "6,0,d",
                        "left": "1619px",
                        "title": "Spider",
                        "top": "107px",
                        "type": "dummy",
                        "view": "6",
                        "width": "64px"
                    },
                    "6,0,i": {
                        "faviconChrome": "false",
                        "height": "64px",
                        "icon": "https://i.pinimg.com/originals/d0/25/95/d02595bbfd3b1e16b3ad2eac4550d2df.gif",
                        "id": "6,0,i",
                        "left": "1025px",
                        "links": [
                            0,
                            1,
                            2,
                            3,
                            4
                        ],
                        "title": "Todo",
                        "top": "194px",
                        "type": "item",
                        "view": "6",
                        "width": "64px"
                    },
                    "6,0,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://www.shazam.com/",
                        "id": "6,0,i,0",
                        "link": "https://www.shazam.com/",
                        "title": "",
                        "view": "6"
                    },
                    "6,0,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://outlook.live.com/",
                        "id": "6,0,i,1",
                        "link": "https://outlook.live.com/",
                        "title": "",
                        "view": "6"
                    },
                    "6,0,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://www.producthunt.com/",
                        "id": "6,0,i,2",
                        "link": "https://www.producthunt.com/",
                        "title": "",
                        "view": "6"
                    },
                    "6,0,i,3": {
                        "faviconChrome": "false",
                        "icon": "https://dribbble.com/",
                        "id": "6,0,i,3",
                        "link": "https://dribbble.com/",
                        "title": "",
                        "view": "6"
                    },
                    "6,0,i,4": {
                        "faviconChrome": "false",
                        "icon": "https://www.google.com/",
                        "id": "6,0,i,4",
                        "link": "https://www.google.com/",
                        "title": "",
                        "view": "6"
                    },
                    "6,1,d": {
                        "height": "74px",
                        "icon": "https://i.pinimg.com/originals/11/66/99/1166990dd805b8ec53ff7da8d5fa941c.gif",
                        "id": "6,1,d",
                        "left": "633px",
                        "title": "Plant",
                        "top": "498px",
                        "type": "dummy",
                        "view": "6",
                        "width": "72px"
                    },
                    "6,1,i": {
                        "faviconChrome": "false",
                        "height": "107px",
                        "icon": "https://bookscador-pi.vercel.app/_next/image?url=https%3A%2F%2Fres.cloudinary.com%2Fknowhere%2Fimage%2Fupload%2Fv1667690640%2FBookscador%2Fstatic%2Fbooks-gif-unscreen_xvsiyu.gif&w=640&q=75",
                        "id": "6,1,i",
                        "left": "130px",
                        "links": [
                            0
                        ],
                        "title": "Project1",
                        "top": "212px",
                        "type": "item",
                        "view": "6",
                        "width": "107px"
                    },
                    "6,1,i,0": {
                        "faviconChrome": "false",
                        "icon": "file:///C:/Users/User/Downloads/sample-local-pdf.pdf",
                        "id": "6,1,i,0",
                        "link": "file:///C:/Users/User/Downloads/sample-local-pdf.pdf",
                        "title": "Sample PDF",
                        "view": "6"
                    },
                    "6,2,d": {
                        "height": "324px",
                        "icon": "https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUyaDY1c2FrNmx6NXptcnJ2a3kzaTRwdWhqZXd4YXlybzVjczhmc290ZiZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/96lyPpSu1MVjLfM0ZB/giphy_s.gif",
                        "id": "6,2,d",
                        "left": "1082px",
                        "title": "Chair",
                        "top": "397px",
                        "type": "dummy",
                        "view": "6",
                        "width": "275px"
                    },
                    "6,2,i": {
                        "faviconChrome": "false",
                        "height": "64px",
                        "icon": "images/folder.png",
                        "id": "6,2,i",
                        "left": "292px",
                        "links": [
                            0,
                            1,
                            2,
                            3
                        ],
                        "title": "Project2",
                        "top": "349px",
                        "type": "item",
                        "view": "6",
                        "width": "64px"
                    },
                    "6,2,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://www.tiktok.com/",
                        "id": "6,2,i,0",
                        "link": "https://www.tiktok.com/",
                        "title": "TikTok",
                        "view": "6"
                    },
                    "6,2,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.pluralsight.com/",
                        "id": "6,2,i,1",
                        "link": "https://www.pluralsight.com/",
                        "title": "Pluralsight",
                        "view": "6"
                    },
                    "6,2,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://www.indeed.com/",
                        "id": "6,2,i,2",
                        "link": "https://www.indeed.com/",
                        "title": "Indeed",
                        "view": "6"
                    },
                    "6,2,i,3": {
                        "faviconChrome": "false",
                        "icon": "https://www.ziprecruiter.com/",
                        "id": "6,2,i,3",
                        "link": "https://www.ziprecruiter.com/",
                        "title": "ZipRecruiter",
                        "view": "6"
                    },
                    "6,3,i": {
                        "faviconChrome": "false",
                        "height": "60px",
                        "icon": "https://i.pinimg.com/originals/e8/67/23/e867230bda2719d8e267961a9d82d3b5.gif",
                        "id": "6,3,i",
                        "left": "1533px",
                        "links": [
                            0,
                            1
                        ],
                        "title": "music",
                        "top": "365px",
                        "type": "item",
                        "view": "6",
                        "width": "66px"
                    },
                    "6,3,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://www.youtube.com/results?search_query=techno+remix",
                        "id": "6,3,i,0",
                        "link": "https://www.youtube.com/results?search_query=techno+remix",
                        "title": "techno remix - YouTube",
                        "view": "6"
                    },
                    "6,3,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.tiktok.com/",
                        "id": "6,3,i,1",
                        "link": "https://www.tiktok.com/",
                        "title": "TikTok",
                        "view": "6"
                    },
                    "6,4,i": {
                        "faviconChrome": "false",
                        "height": "64px",
                        "icon": "https://media1.giphy.com/media/v1.Y2lkPTZjMDliOTUydWt6ZjlieGExcDBzcm5xYTZ4dTFmaDdtaHk4Z3oybjNwdHJ1MzdqeCZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/KxlbRn0HuTW7gZID83/giphy.gif",
                        "id": "6,4,i",
                        "left": "1123px",
                        "links": [
                            0,
                            1,
                            2
                        ],
                        "title": "Mail",
                        "top": "197px",
                        "type": "item",
                        "view": "6",
                        "width": "64px"
                    },
                    "6,4,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://mail.yahoo.com/",
                        "id": "6,4,i,0",
                        "link": "https://mail.yahoo.com/",
                        "title": "Yahoo Mail",
                        "view": "6"
                    },
                    "6,4,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://mail.google.com/",
                        "id": "6,4,i,1",
                        "link": "https://mail.google.com/",
                        "title": "Gmail",
                        "view": "6"
                    },
                    "6,4,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://outlook.live.com/",
                        "id": "6,4,i,2",
                        "link": "https://outlook.live.com/",
                        "title": "Outlook",
                        "view": "6"
                    },
                    "6,6,i": {
                        "faviconChrome": "false",
                        "height": "107px",
                        "icon": "https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUyeTgxZjZ5MmpreGJnemlvZDJzMnpjajR6em5jaW15OWVsNmt4cnZ6byZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/mAZf4H4Pi0wwlj3ZAw/giphy.gif",
                        "id": "6,6,i",
                        "left": "1364px",
                        "links": [
                            0,
                            1,
                            2,
                            3
                        ],
                        "title": "Laptop",
                        "top": "451px",
                        "type": "item",
                        "view": "6",
                        "width": "106px"
                    },
                    "6,6,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://evernote.com/",
                        "id": "6,6,i,0",
                        "link": "https://evernote.com/",
                        "title": "Evernote",
                        "view": "6"
                    },
                    "6,6,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.dropbox.com/",
                        "id": "6,6,i,1",
                        "link": "https://www.dropbox.com/",
                        "title": "Dropbox",
                        "view": "6"
                    },
                    "6,6,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://asana.com/",
                        "id": "6,6,i,2",
                        "link": "https://asana.com/",
                        "title": "Asana",
                        "view": "6"
                    },
                    "6,6,i,3": {
                        "faviconChrome": "false",
                        "icon": "https://www.kayak.com/",
                        "id": "6,6,i,3",
                        "link": "https://www.kayak.com/",
                        "title": "Kayak",
                        "view": "6"
                    },
                    "6,7,i": {
                        "faviconChrome": "false",
                        "height": "124px",
                        "icon": "https://www.icegif.com/wp-content/uploads/2022/07/icegif-846.gif",
                        "id": "6,7,i",
                        "left": "1032px",
                        "links": [
                            0,
                            1,
                            2
                        ],
                        "title": "TeamWork",
                        "top": "311px",
                        "type": "item",
                        "view": "6",
                        "width": "173px"
                    },
                    "6,7,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://weather.com/",
                        "id": "6,7,i,0",
                        "link": "https://weather.com/",
                        "title": "Weather",
                        "view": "6"
                    },
                    "6,7,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://giphy.com/",
                        "id": "6,7,i,1",
                        "link": "https://giphy.com/",
                        "title": "GIPHY",
                        "view": "6"
                    },
                    "6,7,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://pixabay.com/",
                        "id": "6,7,i,2",
                        "link": "https://pixabay.com/",
                        "title": "Pixabay",
                        "view": "6"
                    },
                    "6,8,i": {
                        "faviconChrome": "false",
                        "height": "64px",
                        "icon": "https://i.pinimg.com/originals/bb/a7/ff/bba7ff75d0034045961d842de0ba14fa.gif",
                        "id": "6,8,i",
                        "left": "587px",
                        "links": [
                            0,
                            1
                        ],
                        "title": "Game",
                        "top": "406px",
                        "type": "item",
                        "view": "6",
                        "width": "64px"
                    },
                    "6,8,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://discord.com/",
                        "id": "6,8,i,0",
                        "link": "https://discord.com/",
                        "title": "Discord",
                        "view": "6"
                    },
                    "6,8,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.netflix.com/",
                        "id": "6,8,i,1",
                        "link": "https://www.netflix.com/",
                        "title": "Netflix",
                        "view": "6"
                    },
                    "7,0,i": {
                        "faviconChrome": "false",
                        "height": "480px",
                        "icon": "https://31.media.tumblr.com/092a9dcd4cf3c5583d51190b7d067355/tumblr_mrk98jRynK1szz4eeo1_400.gif",
                        "id": "7,0,i",
                        "left": "1230px",
                        "links": [
                            0,
                            1
                        ],
                        "title": "Activities",
                        "top": "348px",
                        "type": "item",
                        "view": "7",
                        "width": "531px"
                    },
                    "7,0,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://www.whatsapp.com/",
                        "id": "7,0,i,0",
                        "link": "https://www.whatsapp.com/",
                        "title": "WhatsApp",
                        "view": "7"
                    },
                    "7,0,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://chatgpt.com/",
                        "id": "7,0,i,1",
                        "link": "https://chatgpt.com/",
                        "title": "ChatGPT",
                        "view": "7"
                    },
                    "7,1,i": {
                        "faviconChrome": "false",
                        "height": "88px",
                        "icon": "https://media3.giphy.com/media/l2QE6znHVshMqR5ba/source.gif",
                        "id": "7,1,i",
                        "left": "702px",
                        "links": [
                            0
                        ],
                        "title": "Homeworks2",
                        "top": "396px",
                        "type": "item",
                        "view": "7",
                        "width": "161px"
                    },
                    "7,1,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://workspace.google.com/intl/en-US/gmail/",
                        "id": "7,1,i,0",
                        "link": "https://workspace.google.com/intl/en-US/gmail/",
                        "title": "Gmail: Private and secure email at no cost | Google Workspace",
                        "view": "7"
                    },
                    "7,2,i": {
                        "faviconChrome": "false",
                        "height": "407px",
                        "icon": "https://i.pinimg.com/originals/f7/63/bf/f763bf4800723a0bd029953a5a2f9c96.gif",
                        "id": "7,2,i",
                        "left": "170px",
                        "links": [
                            0
                        ],
                        "title": "Friends",
                        "top": "507px",
                        "type": "item",
                        "view": "7",
                        "width": "517px"
                    },
                    "7,2,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://www.youtube.com/results?search_query=techno+remix",
                        "id": "7,2,i,0",
                        "link": "https://www.youtube.com/results?search_query=techno+remix",
                        "title": "techno remix - YouTube",
                        "view": "7"
                    },
                    "7,3,i": {
                        "faviconChrome": "false",
                        "height": "172px",
                        "icon": "https://cdn.pixabay.com/animation/2023/04/20/16/21/16-21-21-180_512.gif",
                        "id": "7,3,i",
                        "left": "306px",
                        "links": [
                            0,
                            1,
                            2
                        ],
                        "title": "Clothing",
                        "top": "210px",
                        "type": "item",
                        "view": "7",
                        "width": "132px"
                    },
                    "7,3,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://www.amazon.com/",
                        "id": "7,3,i,0",
                        "link": "https://www.amazon.com/",
                        "title": "Amazon",
                        "view": "7"
                    },
                    "7,3,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.ebay.com/",
                        "id": "7,3,i,1",
                        "link": "https://www.ebay.com/",
                        "title": "eBay",
                        "view": "7"
                    },
                    "7,3,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://evernote.com/",
                        "id": "7,3,i,2",
                        "link": "https://evernote.com/",
                        "title": "Evernote",
                        "view": "7"
                    },
                    "8,0,i": {
                        "faviconChrome": "false",
                        "height": "84px",
                        "icon": "https://media2.giphy.com/media/v1.Y2lkPTZjMDliOTUydGZmc2g3bnZtb3ptMXczOTgzMXJob2pybzZ4NjBrYWt0bmZxNWRqZyZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/5QTCH9HcixzA1STEs9/source.gif",
                        "id": "8,0,i",
                        "left": "1041px",
                        "links": [
                            0,
                            1
                        ],
                        "title": "Upgrades",
                        "top": "597px",
                        "type": "item",
                        "view": "8",
                        "width": "87px"
                    },
                    "8,0,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://chatgpt.com/",
                        "id": "8,0,i,0",
                        "link": "https://chatgpt.com/",
                        "title": "ChatGPT",
                        "view": "8"
                    },
                    "8,0,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.ebay.com/",
                        "id": "8,0,i,1",
                        "link": "https://www.ebay.com/",
                        "title": "Electronics, Cars, Fashion, Collectibles & More | eBay",
                        "view": "8"
                    },
                    "9,0,i": {
                        "faviconChrome": "false",
                        "height": "64px",
                        "icon": "https://media.giphy.com/media/1oF1MaxVOqrgtG4hev/giphy.gif",
                        "id": "9,0,i",
                        "left": "243px",
                        "links": [
                            0,
                            1,
                            2,
                            3
                        ],
                        "title": "USA",
                        "top": "234px",
                        "type": "item",
                        "view": "9",
                        "width": "64px"
                    },
                    "9,0,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://www.crunchbase.com/",
                        "id": "9,0,i,0",
                        "link": "https://www.crunchbase.com/",
                        "title": "Crunchbase",
                        "view": "9"
                    },
                    "9,0,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://angel.co/",
                        "id": "9,0,i,1",
                        "link": "https://angel.co/",
                        "title": "AngelList",
                        "view": "9"
                    },
                    "9,0,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://www.airbnb.com/",
                        "id": "9,0,i,2",
                        "link": "https://www.airbnb.com/",
                        "title": "Airbnb",
                        "view": "9"
                    },
                    "9,0,i,3": {
                        "faviconChrome": "false",
                        "icon": "https://www.booking.com/",
                        "id": "9,0,i,3",
                        "link": "https://www.booking.com/",
                        "title": "Booking",
                        "view": "9"
                    },
                    "9,1,i": {
                        "faviconChrome": "false",
                        "height": "64px",
                        "icon": "https://media.giphy.com/media/1oF1MaxVOqrgtG4hev/giphy.gif",
                        "id": "9,1,i",
                        "left": "952px",
                        "links": [
                            0,
                            1,
                            2,
                            3,
                            4
                        ],
                        "title": "Germany",
                        "top": "244px",
                        "type": "item",
                        "view": "9",
                        "width": "64px"
                    },
                    "9,1,i,0": {
                        "faviconChrome": "false",
                        "icon": "https://www.accuweather.com/",
                        "id": "9,1,i,0",
                        "link": "https://www.accuweather.com/",
                        "title": "AccuWeather",
                        "view": "9"
                    },
                    "9,1,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://www.coingecko.com/",
                        "id": "9,1,i,1",
                        "link": "https://www.coingecko.com/",
                        "title": "CoinGecko",
                        "view": "9"
                    },
                    "9,1,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://www.glassdoor.com/",
                        "id": "9,1,i,2",
                        "link": "https://www.glassdoor.com/",
                        "title": "Glassdoor",
                        "view": "9"
                    },
                    "9,1,i,3": {
                        "faviconChrome": "false",
                        "icon": "https://www.airbnb.com/",
                        "id": "9,1,i,3",
                        "link": "https://www.airbnb.com/",
                        "title": "Airbnb",
                        "view": "9"
                    },
                    "9,1,i,4": {
                        "faviconChrome": "false",
                        "icon": "https://www.booking.com/",
                        "id": "9,1,i,4",
                        "link": "https://www.booking.com/",
                        "title": "Booking",
                        "view": "9"
                    },
                    "9,2,i": {
                        "faviconChrome": "false",
                        "height": "102px",
                        "icon": "https://media.baamboozle.com/uploads/images/1352256/a8eb776a-daf5-4655-af59-69d04a73bea8.gif",
                        "id": "9,2,i",
                        "left": "568px",
                        "links": [
                            0,
                            1,
                            2
                        ],
                        "title": "Passports",
                        "top": "816px",
                        "type": "item",
                        "view": "9",
                        "width": "92px"
                    },
                    "9,2,i,0": {
                        "faviconChrome": "false",
                        "icon": "file:///C:/Users/User/Downloads/sample-local-pdf.pdf",
                        "id": "9,2,i,0",
                        "link": "file:///C:/Users/User/Downloads/sample-local-pdf.pdf",
                        "title": "Sample PDF",
                        "view": "9"
                    },
                    "9,2,i,1": {
                        "faviconChrome": "false",
                        "icon": "https://chatgpt.com/",
                        "id": "9,2,i,1",
                        "link": "https://chatgpt.com/",
                        "title": "ChatGPT",
                        "view": "9"
                    },
                    "9,2,i,2": {
                        "faviconChrome": "false",
                        "icon": "https://www.ebay.com/",
                        "id": "9,2,i,2",
                        "link": "https://www.ebay.com/",
                        "title": "Electronics, Cars, Fashion, Collectibles & More | eBay",
                        "view": "9"
                    },
                    "backgrounds": {
                        "id": "backgrounds",
                        "links": [
                            0,
                            1,
                            2,
                            3,
                            4,
                            5,
                            6,
                            7,
                            9,
                            10,
                            11,
                            12,
                            13,
                            14,
                            15,
                            16,
                            17,
                            18,
                            19,
                            20,
                            21
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
                    "backgrounds,10": {
                        "id": "backgrounds,10",
                        "link": "https://en.idei.club/uploads/posts/2023-03/1679029533_en-idei-club-p-programmer-home-office-interer-1.jpg",
                        "title": "https://en.idei.club/uploads/posts/2023-03/1679029533_en-idei-club-p-programmer-home-office-interer-1.jpg"
                    },
                    "backgrounds,11": {
                        "id": "backgrounds,11",
                        "link": "https://images.unsplash.com/photo-1588854337127-a7cdcabfd7ac?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8YmFieSUyMHJvb218ZW58MHx8MHx8fDA%3D",
                        "title": "https://images.unsplash.com/photo-1588854337127-a7cdcabfd7ac?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8YmFieSUyMHJvb218ZW58MHx8MHx8fDA%3D"
                    },
                    "backgrounds,12": {
                        "id": "backgrounds,12",
                        "link": "https://pbs.twimg.com/media/FSunEp_WUAMKYhB.jpg:large",
                        "title": "https://pbs.twimg.com/media/FSunEp_WUAMKYhB.jpg:large"
                    },
                    "backgrounds,13": {
                        "id": "backgrounds,13",
                        "link": "https://marketplace.canva.com/EAGKYZUC4_Q/1/0/1600w/canva-brown-and-cream-manhwa-anime-study-desk-organizer-desktop-wallpaper-5W6BbMBb-2g.jpg",
                        "title": "https://marketplace.canva.com/EAGKYZUC4_Q/1/0/1600w/canva-brown-and-cream-manhwa-anime-study-desk-organizer-desktop-wallpaper-5W6BbMBb-2g.jpg"
                    },
                    "backgrounds,14": {
                        "id": "backgrounds,14",
                        "link": "https://d7hftxdivxxvm.cloudfront.net/?height=900&quality=80&resize_to=fill&src=https%3A%2F%2Fartsy-media-uploads.s3.amazonaws.com%2F2P6t_Yt6dF0TNN76dlp-_Q%252F3417757448_4a6bdf36ce_o.jpg&width=1200",
                        "title": "https://d7hftxdivxxvm.cloudfront.net/?height=900&quality=80&resize_to=fill&src=https%3A%2F%2Fartsy-media-uploads.s3.amazonaws.com%2F2P6t_Yt6dF0TNN76dlp-_Q%252F3417757448_4a6bdf36ce_o.jpg&width=1200"
                    },
                    "backgrounds,15": {
                        "id": "backgrounds,15",
                        "link": "https://muralsyourway.vtexassets.com/arquivos/ids/257115/Travel-The-World-Map-Wallpaper-Mural.jpg?v=638164887221970000",
                        "title": "https://muralsyourway.vtexassets.com/arquivos/ids/257115/Travel-The-World-Map-Wallpaper-Mural.jpg?v=638164887221970000"
                    },
                    "backgrounds,16": {
                        "id": "backgrounds,16",
                        "link": "https://4kwallpapers.com/images/wallpapers/world-map-design-3840x2160-16644.jpg",
                        "title": "https://4kwallpapers.com/images/wallpapers/world-map-design-3840x2160-16644.jpg"
                    },
                    "backgrounds,17": {
                        "id": "backgrounds,17",
                        "link": "https://wallpapers.com/images/hd/modern-office-background-1920-x-1200-3u7w0j7r25g1rh55.jpg",
                        "title": "https://wallpapers.com/images/hd/modern-office-background-1920-x-1200-3u7w0j7r25g1rh55.jpg"
                    },
                    "backgrounds,18": {
                        "id": "backgrounds,18",
                        "link": "https://muralsyourway.vtexassets.com/arquivos/ids/257115/Travel-The-World-Map-Wallpaper-Mural.jpg?v=638164887221970000",
                        "title": "https://muralsyourway.vtexassets.com/arquivos/ids/257115/Travel-The-World-Map-Wallpaper-Mural.jpg?v=638164887221970000"
                    },
                    "backgrounds,19": {
                        "id": "backgrounds,19",
                        "link": "https://wallpapers.com/images/hd/empty-room-with-office-equipment-2d2pm54znqin9p54.jpg",
                        "title": "https://wallpapers.com/images/hd/empty-room-with-office-equipment-2d2pm54znqin9p54.jpg"
                    },
                    "backgrounds,2": {
                        "id": "backgrounds,2",
                        "link": "/images/living-room-animation.jpg",
                        "title": "living room",
                        "view": 0
                    },
                    "backgrounds,20": {
                        "id": "backgrounds,20",
                        "link": "https://wallpapers.com/images/hd/cute-desktop-folder-organizer-h8kbe0iyfztgdkhr.jpg",
                        "title": "https://wallpapers.com/images/hd/cute-desktop-folder-organizer-h8kbe0iyfztgdkhr.jpg"
                    },
                    "backgrounds,21": {
                        "id": "backgrounds,21",
                        "link": "https://static.vecteezy.com/system/resources/previews/016/962/027/non_2x/kids-bedroom-with-bed-table-toys-and-wardrobe-free-vector.jpg",
                        "title": "https://static.vecteezy.com/system/resources/previews/016/962/027/non_2x/kids-bedroom-with-bed-table-toys-and-wardrobe-free-vector.jpg"
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
                    "backgrounds,6": {
                        "id": "backgrounds,6",
                        "link": "https://www.decorilla.com/online-decorating/wp-content/uploads/2020/12/Moody-home-office-background-with-builtin-shelves-scaled.jpeg",
                        "title": "https://www.decorilla.com/online-decorating/wp-content/uploads/2020/12/Moody-home-office-background-with-builtin-shelves-scaled.jpeg"
                    },
                    "backgrounds,7": {
                        "id": "backgrounds,7",
                        "link": "https://m.media-amazon.com/images/I/71j4Dgtx0sL.jpg",
                        "title": "https://m.media-amazon.com/images/I/71j4Dgtx0sL.jpg"
                    },
                    "backgrounds,9": {
                        "id": "backgrounds,9",
                        "link": "https://img.freepik.com/free-vector/office-background-video-conference_23-2148657195.jpg?semt=ais_incoming&w=740&q=80",
                        "title": "https://img.freepik.com/free-vector/office-background-video-conference_23-2148657195.jpg?semt=ais_incoming&w=740&q=80"
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
                            12,
                            13,
                            14,
                            15,
                            16,
                            17,
                            18,
                            19,
                            20,
                            21,
                            22,
                            23,
                            24,
                            25,
                            26,
                            27,
                            28,
                            29,
                            30,
                            34,
                            35,
                            36,
                            37,
                            38,
                            39,
                            40,
                            41,
                            42,
                            43,
                            44,
                            45,
                            46,
                            47,
                            48,
                            49,
                            50,
                            51,
                            52,
                            53,
                            54,
                            55,
                            56,
                            57,
                            58,
                            59,
                            60,
                            61,
                            62,
                            63,
                            64,
                            65,
                            66,
                            67,
                            68,
                            69,
                            70
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
                    "gifs,13": {
                        "id": "gifs,13",
                        "link": "https://giffiles.alphacoders.com/129/12900.gif",
                        "title": "https://giffiles.alphacoders.com/129/12900.gif"
                    },
                    "gifs,14": {
                        "id": "gifs,14",
                        "link": "https://gifgifs.com/animations/anime/dragon-ball-z/Goku/goku_70.gif",
                        "title": "https://gifgifs.com/animations/anime/dragon-ball-z/Goku/goku_70.gif"
                    },
                    "gifs,15": {
                        "id": "gifs,15",
                        "link": "https://i.pinimg.com/originals/f7/63/bf/f763bf4800723a0bd029953a5a2f9c96.gif",
                        "title": "https://i.pinimg.com/originals/f7/63/bf/f763bf4800723a0bd029953a5a2f9c96.gif"
                    },
                    "gifs,16": {
                        "id": "gifs,16",
                        "link": "https://media2.giphy.com/media/v1.Y2lkPTZjMDliOTUyZWU4N2E1Y29vN3ZnYmhsZzVmeDU0aTRqa2MwMmZibzhrdXY0N2tsbSZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/2YEFsPpBx9bdqftKpk/source.gif",
                        "title": "https://media2.giphy.com/media/v1.Y2lkPTZjMDliOTUyZWU4N2E1Y29vN3ZnYmhsZzVmeDU0aTRqa2MwMmZibzhrdXY0N2tsbSZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/2YEFsPpBx9bdqftKpk/source.gif"
                    },
                    "gifs,17": {
                        "id": "gifs,17",
                        "link": "https://www.yanncrozet.com/wp-content/uploads/2018/12/Football_Team_Anim_FT_3mo.gif",
                        "title": "https://www.yanncrozet.com/wp-content/uploads/2018/12/Football_Team_Anim_FT_3mo.gif"
                    },
                    "gifs,18": {
                        "id": "gifs,18",
                        "link": "https://media4.giphy.com/media/v1.Y2lkPTZjMDliOTUyaXIzZjRyaWtydTJ3Z2pvYzA4MzBsMmlsbXZhbGI4bDBjMG1mazQ3biZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/z0hUv6bpBWUUOtShDf/giphy.gif",
                        "title": "https://media4.giphy.com/media/v1.Y2lkPTZjMDliOTUyaXIzZjRyaWtydTJ3Z2pvYzA4MzBsMmlsbXZhbGI4bDBjMG1mazQ3biZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/z0hUv6bpBWUUOtShDf/giphy.gif"
                    },
                    "gifs,19": {
                        "id": "gifs,19",
                        "link": "https://24.media.tumblr.com/8d80361ed854052b921d7949e6c50eb8/tumblr_mkucb0d34z1r67h3uo1_500.gif",
                        "title": "https://24.media.tumblr.com/8d80361ed854052b921d7949e6c50eb8/tumblr_mkucb0d34z1r67h3uo1_500.gif"
                    },
                    "gifs,2": {
                        "id": "gifs,2",
                        "link": "https://i.pinimg.com/originals/04/c4/a8/04c4a8baf0068b244bed7b7df509898f.gif",
                        "title": "https://i.pinimg.com/originals/04/c4/a8/04c4a8baf0068b244bed7b7df509898f.gif"
                    },
                    "gifs,20": {
                        "id": "gifs,20",
                        "link": "https://media2.giphy.com/media/bJ3KaxQPF8UNbGFG1R/giphy.gif",
                        "title": "https://media2.giphy.com/media/bJ3KaxQPF8UNbGFG1R/giphy.gif"
                    },
                    "gifs,21": {
                        "id": "gifs,21",
                        "link": "https://www.teacherfoundation.org/wp-content/uploads/2025/08/GPLG4C.gif",
                        "title": "https://www.teacherfoundation.org/wp-content/uploads/2025/08/GPLG4C.gif"
                    },
                    "gifs,22": {
                        "id": "gifs,22",
                        "link": "https://epe.brightspotcdn.com/dims4/default/ad332a6/2147483647/strip/true/crop/3537x2400+32+0/resize/840x570!/quality/90/?url=https%3A%2F%2Fepe-brightspot.s3.us-east-1.amazonaws.com%2Ff1%2F6c%2F17d7d1bf4dc790e6b978b8a51f98%2Fai-age-appropriate-animated.gif",
                        "title": "https://epe.brightspotcdn.com/dims4/default/ad332a6/2147483647/strip/true/crop/3537x2400+32+0/resize/840x570!/quality/90/?url=https%3A%2F%2Fepe-brightspot.s3.us-east-1.amazonaws.com%2Ff1%2F6c%2F17d7d1bf4dc790e6b978b8a51f98%2Fai-age-appropriate-animated.gif"
                    },
                    "gifs,23": {
                        "id": "gifs,23",
                        "link": "https://i.pinimg.com/originals/82/28/2c/82282cde0b4d73445967aea7f761bda9.gif",
                        "title": "https://i.pinimg.com/originals/82/28/2c/82282cde0b4d73445967aea7f761bda9.gif"
                    },
                    "gifs,24": {
                        "id": "gifs,24",
                        "link": "https://media2.giphy.com/media/v1.Y2lkPTZjMDliOTUyNXJkZDBwZHVqd2U2Zzh5ZXk4MDkzamw5c2ttM2t3ZGVsODg3MXluOCZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/6IfdksCcmX1l5yCqBy/giphy.gif",
                        "title": "https://media2.giphy.com/media/v1.Y2lkPTZjMDliOTUyNXJkZDBwZHVqd2U2Zzh5ZXk4MDkzamw5c2ttM2t3ZGVsODg3MXluOCZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/6IfdksCcmX1l5yCqBy/giphy.gif"
                    },
                    "gifs,25": {
                        "id": "gifs,25",
                        "link": "https://classroomclipart.com/images/gallery/Animations/Education_School/animated-clipart-student-sliding-down-stack-books-05c.gif",
                        "title": "https://classroomclipart.com/images/gallery/Animations/Education_School/animated-clipart-student-sliding-down-stack-books-05c.gif"
                    },
                    "gifs,26": {
                        "id": "gifs,26",
                        "link": "https://cdnl.iconscout.com/lottie/premium/thumb/going-to-school-animated-sticker-gif-download-8426879.gif",
                        "title": "https://cdnl.iconscout.com/lottie/premium/thumb/going-to-school-animated-sticker-gif-download-8426879.gif"
                    },
                    "gifs,27": {
                        "id": "gifs,27",
                        "link": "https://data.textstudio.com/output/sample/animated/1/3/5/5/office-5-5531.gif",
                        "title": "https://data.textstudio.com/output/sample/animated/1/3/5/5/office-5-5531.gif"
                    },
                    "gifs,28": {
                        "id": "gifs,28",
                        "link": "https://ugokawaii.com/wp-content/uploads/2023/07/baby.gif",
                        "title": "https://ugokawaii.com/wp-content/uploads/2023/07/baby.gif"
                    },
                    "gifs,29": {
                        "id": "gifs,29",
                        "link": "https://media.tenor.com/9t1h1z2NNzUAAAAj/hello-business.gif",
                        "title": "https://media.tenor.com/9t1h1z2NNzUAAAAj/hello-business.gif"
                    },
                    "gifs,3": {
                        "id": "gifs,3",
                        "link": "https://media.baamboozle.com/uploads/images/323666/1624532385_171205_gif-url.gif",
                        "title": "https://media.baamboozle.com/uploads/images/323666/1624532385_171205_gif-url.gif"
                    },
                    "gifs,30": {
                        "id": "gifs,30",
                        "link": "https://media.tenor.com/rvDQSe2TtvwAAAAj/community-office.gif",
                        "title": "https://media.tenor.com/rvDQSe2TtvwAAAAj/community-office.gif"
                    },
                    "gifs,34": {
                        "id": "gifs,34",
                        "link": "https://static.vecteezy.com/system/resources/previews/060/424/047/non_2x/modern-detached-garage-with-white-siding-and-two-roll-up-doors-offering-spacious-vehicle-storage-and-a-clean-exterior-design-free-png.png",
                        "title": "https://static.vecteezy.com/system/resources/previews/060/424/047/non_2x/modern-detached-garage-with-white-siding-and-two-roll-up-doors-offering-spacious-vehicle-storage-and-a-clean-exterior-design-free-png.png"
                    },
                    "gifs,35": {
                        "id": "gifs,35",
                        "link": "https://media2.giphy.com/media/v1.Y2lkPTZjMDliOTUydGZmc2g3bnZtb3ptMXczOTgzMXJob2pybzZ4NjBrYWt0bmZxNWRqZyZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/5QTCH9HcixzA1STEs9/source.gif",
                        "title": "https://media2.giphy.com/media/v1.Y2lkPTZjMDliOTUydGZmc2g3bnZtb3ptMXczOTgzMXJob2pybzZ4NjBrYWt0bmZxNWRqZyZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/5QTCH9HcixzA1STEs9/source.gif"
                    },
                    "gifs,36": {
                        "id": "gifs,36",
                        "link": "https://media0.giphy.com/media/v1.Y2lkPTZjMDliOTUyZGZuZ250NGd0eHY0dmFtZHplYWcyYm1mcXRld3p1bnM3MTBjdGN3NSZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/1xnu4sgy1FpbHXZoW6/source.gif",
                        "title": "https://media0.giphy.com/media/v1.Y2lkPTZjMDliOTUyZGZuZ250NGd0eHY0dmFtZHplYWcyYm1mcXRld3p1bnM3MTBjdGN3NSZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/1xnu4sgy1FpbHXZoW6/source.gif"
                    },
                    "gifs,37": {
                        "id": "gifs,37",
                        "link": "https://media.baamboozle.com/uploads/images/409488/1653542839_23060.gif",
                        "title": "https://media.baamboozle.com/uploads/images/409488/1653542839_23060.gif"
                    },
                    "gifs,38": {
                        "id": "gifs,38",
                        "link": "https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUyeTgxZjZ5MmpreGJnemlvZDJzMnpjajR6em5jaW15OWVsNmt4cnZ6byZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/mAZf4H4Pi0wwlj3ZAw/giphy.gif",
                        "title": "https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUyeTgxZjZ5MmpreGJnemlvZDJzMnpjajR6em5jaW15OWVsNmt4cnZ6byZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/mAZf4H4Pi0wwlj3ZAw/giphy.gif"
                    },
                    "gifs,39": {
                        "id": "gifs,39",
                        "link": "https://i.pinimg.com/originals/d0/25/95/d02595bbfd3b1e16b3ad2eac4550d2df.gif",
                        "title": "https://i.pinimg.com/originals/d0/25/95/d02595bbfd3b1e16b3ad2eac4550d2df.gif"
                    },
                    "gifs,4": {
                        "id": "gifs,4",
                        "link": "https://upload.wikimedia.org/wikipedia/commons/6/6a/Orange_animated_left_arrow.gif",
                        "title": "https://upload.wikimedia.org/wikipedia/commons/6/6a/Orange_animated_left_arrow.gif"
                    },
                    "gifs,40": {
                        "id": "gifs,40",
                        "link": "https://i.pinimg.com/originals/39/79/6a/39796ac6bf7fb5abd5814c8f61bf3ab1.gif",
                        "title": "https://i.pinimg.com/originals/39/79/6a/39796ac6bf7fb5abd5814c8f61bf3ab1.gif"
                    },
                    "gifs,41": {
                        "id": "gifs,41",
                        "link": "https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUyNjQ5OTF6M3BxN3poMXZ3Nm93ZG5ueHhsaHFhOGQ5aG1jaDJ4cmRxNSZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/9rfqu2LxLDdD2/source.gif",
                        "title": "https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUyNjQ5OTF6M3BxN3poMXZ3Nm93ZG5ueHhsaHFhOGQ5aG1jaDJ4cmRxNSZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/9rfqu2LxLDdD2/source.gif"
                    },
                    "gifs,42": {
                        "id": "gifs,42",
                        "link": "https://giffiles.alphacoders.com/394/39410.gif",
                        "title": "https://giffiles.alphacoders.com/394/39410.gif"
                    },
                    "gifs,43": {
                        "id": "gifs,43",
                        "link": "https://media.giphy.com/media/1oF1MaxVOqrgtG4hev/giphy.gif",
                        "title": "https://media.giphy.com/media/1oF1MaxVOqrgtG4hev/giphy.gif"
                    },
                    "gifs,44": {
                        "id": "gifs,44",
                        "link": "https://media3.giphy.com/media/l2QE6znHVshMqR5ba/source.gif",
                        "title": "https://media3.giphy.com/media/l2QE6znHVshMqR5ba/source.gif"
                    },
                    "gifs,45": {
                        "id": "gifs,45",
                        "link": "https://31.media.tumblr.com/092a9dcd4cf3c5583d51190b7d067355/tumblr_mrk98jRynK1szz4eeo1_400.gif",
                        "title": "https://31.media.tumblr.com/092a9dcd4cf3c5583d51190b7d067355/tumblr_mrk98jRynK1szz4eeo1_400.gif"
                    },
                    "gifs,46": {
                        "id": "gifs,46",
                        "link": "https://pa1.aminoapps.com/5580/61d47e8474e24ac4cb98fc673ab1c589c38aa961_hq.gif",
                        "title": "https://pa1.aminoapps.com/5580/61d47e8474e24ac4cb98fc673ab1c589c38aa961_hq.gif"
                    },
                    "gifs,47": {
                        "id": "gifs,47",
                        "link": "https://media2.giphy.com/media/v1.Y2lkPTZjMDliOTUyd2lzenlwN3g1Z3d0a3FyMnY4d29wdTd3NW1nNjJ6enNoZzE2MnF2ZCZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/AwJuJzp1pGrcfO51g6/200.gif",
                        "title": "https://media2.giphy.com/media/v1.Y2lkPTZjMDliOTUyd2lzenlwN3g1Z3d0a3FyMnY4d29wdTd3NW1nNjJ6enNoZzE2MnF2ZCZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/AwJuJzp1pGrcfO51g6/200.gif"
                    },
                    "gifs,48": {
                        "id": "gifs,48",
                        "link": "https://media0.giphy.com/media/v1.Y2lkPTZjMDliOTUyajh1cHJzMmZlZDZtaDN1cm1iYjU1ZWZzcGdpd2t3MWVsbGpoa3hwcyZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/qH15RNEtCR9FAyR8iu/giphy.gif",
                        "title": "https://media0.giphy.com/media/v1.Y2lkPTZjMDliOTUyajh1cHJzMmZlZDZtaDN1cm1iYjU1ZWZzcGdpd2t3MWVsbGpoa3hwcyZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/qH15RNEtCR9FAyR8iu/giphy.gif"
                    },
                    "gifs,49": {
                        "id": "gifs,49",
                        "link": "https://media.baamboozle.com/uploads/images/1352256/a8eb776a-daf5-4655-af59-69d04a73bea8.gif",
                        "title": "https://media.baamboozle.com/uploads/images/1352256/a8eb776a-daf5-4655-af59-69d04a73bea8.gif"
                    },
                    "gifs,5": {
                        "id": "gifs,5",
                        "link": "https://bookscador-pi.vercel.app/_next/image?url=https%3A%2F%2Fres.cloudinary.com%2Fknowhere%2Fimage%2Fupload%2Fv1667690640%2FBookscador%2Fstatic%2Fbooks-gif-unscreen_xvsiyu.gif&w=640&q=75",
                        "title": "https://bookscador-pi.vercel.app/_next/image?url=https%3A%2F%2Fres.cloudinary.com%2Fknowhere%2Fimage%2Fupload%2Fv1667690640%2FBookscador%2Fstatic%2Fbooks-gif-unscreen_xvsiyu.gif&w=640&q=75"
                    },
                    "gifs,50": {
                        "id": "gifs,50",
                        "link": "https://media0.giphy.com/media/v1.Y2lkPTZjMDliOTUybWtwM3R2MmQxNTYxYml2bmJ2MXU3ZHd5bDU5eDlvYW83azY2ODQ0MCZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/gmSQYMDoRrwq06SSCu/source.gif",
                        "title": "https://media0.giphy.com/media/v1.Y2lkPTZjMDliOTUybWtwM3R2MmQxNTYxYml2bmJ2MXU3ZHd5bDU5eDlvYW83azY2ODQ0MCZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/gmSQYMDoRrwq06SSCu/source.gif"
                    },
                    "gifs,51": {
                        "id": "gifs,51",
                        "link": "https://i.pinimg.com/originals/e2/bc/82/e2bc8260173e1dbe01ba2b8b8f1a2d31.gif",
                        "title": "https://i.pinimg.com/originals/e2/bc/82/e2bc8260173e1dbe01ba2b8b8f1a2d31.gif"
                    },
                    "gifs,52": {
                        "id": "gifs,52",
                        "link": "https://media0.giphy.com/media/KGfPkVzol6UJaKm8Jx/giphy.gif",
                        "title": "https://media0.giphy.com/media/KGfPkVzol6UJaKm8Jx/giphy.gif"
                    },
                    "gifs,53": {
                        "id": "gifs,53",
                        "link": "https://i.pinimg.com/originals/1d/fd/00/1dfd007c6a813a29c736f2cb4f8641e5.gif",
                        "title": "https://i.pinimg.com/originals/1d/fd/00/1dfd007c6a813a29c736f2cb4f8641e5.gif"
                    },
                    "gifs,54": {
                        "id": "gifs,54",
                        "link": "https://uat.endemolshinegroup.com/wp-content/uploads/2020/05/Simon-Cat-Alexa.png",
                        "title": "https://uat.endemolshinegroup.com/wp-content/uploads/2020/05/Simon-Cat-Alexa.png"
                    },
                    "gifs,55": {
                        "id": "gifs,55",
                        "link": "https://www.mariahthescientist.com/images/nav/music.gif",
                        "title": "https://www.mariahthescientist.com/images/nav/music.gif"
                    },
                    "gifs,56": {
                        "id": "gifs,56",
                        "link": "https://i.pinimg.com/originals/e8/67/23/e867230bda2719d8e267961a9d82d3b5.gif",
                        "title": "https://i.pinimg.com/originals/e8/67/23/e867230bda2719d8e267961a9d82d3b5.gif"
                    },
                    "gifs,57": {
                        "id": "gifs,57",
                        "link": "https://media1.giphy.com/media/v1.Y2lkPTZjMDliOTUyN295YTI1cWY5d2Vrc3g1MmdyYjgxOTZmbjA0NDhvNjM2aHlrNDh3NiZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/yyJtlSsn2cP8WH1Drv/giphy.gif",
                        "title": "https://media1.giphy.com/media/v1.Y2lkPTZjMDliOTUyN295YTI1cWY5d2Vrc3g1MmdyYjgxOTZmbjA0NDhvNjM2aHlrNDh3NiZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/yyJtlSsn2cP8WH1Drv/giphy.gif"
                    },
                    "gifs,58": {
                        "id": "gifs,58",
                        "link": "https://cdn-icons-png.flaticon.com/512/4703/4703650.png",
                        "title": "https://cdn-icons-png.flaticon.com/512/4703/4703650.png"
                    },
                    "gifs,59": {
                        "id": "gifs,59",
                        "link": "https://www.iconpacks.net/icons/2/free-folder-icon-1484-thumb.png",
                        "title": "https://www.iconpacks.net/icons/2/free-folder-icon-1484-thumb.png"
                    },
                    "gifs,6": {
                        "id": "gifs,6",
                        "link": "https://i.pinimg.com/originals/cf/f8/1d/cff81d29fab592d2f86c2f81775731c4.gif",
                        "title": "cat jumping"
                    },
                    "gifs,60": {
                        "id": "gifs,60",
                        "link": "https://media1.giphy.com/media/v1.Y2lkPTZjMDliOTUyeHVnYWk3NmV3NnNlYWI3a2dpcW1iZmttZ3pxajF4N29zMjhzNGR5ZiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3o6wrEISO16bXgL7B6/giphy.gif",
                        "title": "https://media1.giphy.com/media/v1.Y2lkPTZjMDliOTUyeHVnYWk3NmV3NnNlYWI3a2dpcW1iZmttZ3pxajF4N29zMjhzNGR5ZiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3o6wrEISO16bXgL7B6/giphy.gif"
                    },
                    "gifs,61": {
                        "id": "gifs,61",
                        "link": "https://media1.giphy.com/media/pzvUEkOeAViy7VS7B6/giphy.gif?cid=a267dfa3zrvx7z6zqh6d4srv0tsguno52jry58ol8qn13thl&rid=giphy.gif&ct=s",
                        "title": "https://media1.giphy.com/media/pzvUEkOeAViy7VS7B6/giphy.gif?cid=a267dfa3zrvx7z6zqh6d4srv0tsguno52jry58ol8qn13thl&rid=giphy.gif&ct=s"
                    },
                    "gifs,62": {
                        "id": "gifs,62",
                        "link": "https://cdn.pixabay.com/animation/2023/04/20/16/21/16-21-21-180_512.gif",
                        "title": "https://cdn.pixabay.com/animation/2023/04/20/16/21/16-21-21-180_512.gif"
                    },
                    "gifs,63": {
                        "id": "gifs,63",
                        "link": "https://i.pinimg.com/originals/77/76/a6/7776a6af7e14e46ae609b5ee03c6037a.gif",
                        "title": "https://i.pinimg.com/originals/77/76/a6/7776a6af7e14e46ae609b5ee03c6037a.gif"
                    },
                    "gifs,64": {
                        "id": "gifs,64",
                        "link": "https://i.redd.it/qzkpthkpayz51.gif",
                        "title": "https://i.redd.it/qzkpthkpayz51.gif"
                    },
                    "gifs,65": {
                        "id": "gifs,65",
                        "link": "https://i.pinimg.com/originals/57/e2/09/57e209296e586933febadf06e271a3d3.gif",
                        "title": "https://i.pinimg.com/originals/57/e2/09/57e209296e586933febadf06e271a3d3.gif"
                    },
                    "gifs,66": {
                        "id": "gifs,66",
                        "link": "https://media1.giphy.com/media/v1.Y2lkPTZjMDliOTUydWt6ZjlieGExcDBzcm5xYTZ4dTFmaDdtaHk4Z3oybjNwdHJ1MzdqeCZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/KxlbRn0HuTW7gZID83/giphy.gif",
                        "title": "https://media1.giphy.com/media/v1.Y2lkPTZjMDliOTUydWt6ZjlieGExcDBzcm5xYTZ4dTFmaDdtaHk4Z3oybjNwdHJ1MzdqeCZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/KxlbRn0HuTW7gZID83/giphy.gif"
                    },
                    "gifs,67": {
                        "id": "gifs,67",
                        "link": "https://www.icegif.com/wp-content/uploads/2022/07/icegif-846.gif",
                        "title": "https://www.icegif.com/wp-content/uploads/2022/07/icegif-846.gif"
                    },
                    "gifs,68": {
                        "id": "gifs,68",
                        "link": "https://i.pinimg.com/originals/bb/a7/ff/bba7ff75d0034045961d842de0ba14fa.gif",
                        "title": "https://i.pinimg.com/originals/bb/a7/ff/bba7ff75d0034045961d842de0ba14fa.gif"
                    },
                    "gifs,69": {
                        "id": "gifs,69",
                        "link": "https://i.pinimg.com/originals/11/66/99/1166990dd805b8ec53ff7da8d5fa941c.gif",
                        "title": "https://i.pinimg.com/originals/11/66/99/1166990dd805b8ec53ff7da8d5fa941c.gif"
                    },
                    "gifs,70": {
                        "id": "gifs,70",
                        "link": "https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUyaDY1c2FrNmx6NXptcnJ2a3kzaTRwdWhqZXd4YXlybzVjczhmc290ZiZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/96lyPpSu1MVjLfM0ZB/giphy_s.gif",
                        "title": "https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUyaDY1c2FrNmx6NXptcnJ2a3kzaTRwdWhqZXd4YXlybzVjczhmc290ZiZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/96lyPpSu1MVjLfM0ZB/giphy_s.gif"
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
                            4,
                            5,
                            6,
                            7,
                            8,
                            9,
                            10,
                            11
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
                        "links": [
                            0,
                            1,
                            2,
                            3,
                            4
                        ]
                    },
                    "trash,0": {
                        "id": "trash,0",
                        "link": "https://w7.pngwing.com/pngs/427/242/png-transparent-garage-car-park-door-shed-a-brick-garage-angle-furniture-van.png",
                        "title": "https://w7.pngwing.com/pngs/427/242/png-transparent-garage-car-park-door-shed-a-brick-garage-angle-furniture-van.png"
                    },
                    "trash,1": {
                        "id": "trash,1",
                        "link": "https://w7.pngwing.com/pngs/811/954/png-transparent-garage-graphics.png",
                        "title": "https://w7.pngwing.com/pngs/811/954/png-transparent-garage-graphics.png"
                    },
                    "trash,2": {
                        "id": "trash,2",
                        "link": "https://e7.pngegg.com/pngimages/486/578/png-clipart-window-garage-doors-garage-door-openers-window-glass-angle.png",
                        "title": "https://e7.pngegg.com/pngimages/486/578/png-clipart-window-garage-doors-garage-door-openers-window-glass-angle.png"
                    },
                    "trash,3": {
                        "id": "trash,3",
                        "link": "https://img.freepik.com/free-vector/realistic-cork-board-with-notes_52683-74053.jpg?semt=ais_incoming&w=740&q=80",
                        "title": "https://img.freepik.com/free-vector/realistic-cork-board-with-notes_52683-74053.jpg?semt=ais_incoming&w=740&q=80"
                    },
                    "trash,4": {
                        "id": "trash,4",
                        "link": "https://media.istockphoto.com/id/1191899737/vector/a-freelancer-programmer-coding-a-program-at-home.jpg?s=612x612&w=0&k=20&c=kYq35K0pW0d788ftElIDwQ8dZ7GL-7EXNyGWZlec6fg=",
                        "title": "https://media.istockphoto.com/id/1191899737/vector/a-freelancer-programmer-coding-a-program-at-home.jpg?s=612x612&w=0&k=20&c=kYq35K0pW0d788ftElIDwQ8dZ7GL-7EXNyGWZlec6fg="
                    }
                }
            );
        })
        await driver.navigate().refresh();
        await driver.quit();

    });

});
