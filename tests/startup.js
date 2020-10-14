'use strict'

let core = require('../dist/core/index').default;

core.start();

setTimeout(function() {
    core.close();
}, 1000);
