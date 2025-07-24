let localStorage = {}
const R = require('ramda');

global.chrome = {
    storage: {
        local: {
            clear: () => {
                localStorage = {}
            },
            set: (toMergeIntoStorage) => {
                localStorage = {...localStorage, ...toMergeIntoStorage}
            },
            get: (keysToInclude) => {
                return R.pick(keysToInclude, localStorage);
            }
        }
    }
}
