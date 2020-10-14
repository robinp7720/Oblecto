'use strict'

let core = require('../dist/core/graphical').default;

core.start();

setTimeout(function() {
    core.close();
}, 1000);
