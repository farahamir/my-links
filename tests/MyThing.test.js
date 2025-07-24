const { TextEncoder } = require('util');
Object.assign(global, { TextEncoder });
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const jQuery = require('jquery');
global.$ = jQuery;

// Load the HTML file into JSDOM
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
let dom;
let document;

beforeEach(() => {
    chrome.storage.local.clear();
});

describe("chrome.storage", () => {
    const id = 'id.name';
    const dataElements = ['data', 1.2, {a: {b: [1, 2]}}];
    for (const data of dataElements) {
        it(`local persist + load ${JSON.stringify(data)}`, async () => {
            await chrome.storage.local.set({[id]: data});
            expect(await chrome.storage.local.get([id])).toEqual({[id]: data});
            expect(await chrome.storage.local.get('not existing')).toEqual({});
        });
    }
})