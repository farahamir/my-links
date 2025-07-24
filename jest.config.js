module.exports = {
    testEnvironment: 'jest-fixed-jsdom',
    setupFilesAfterEnv: ['<rootDir>/mocks/chrome.js'],
    testTimeout: 100000,
};