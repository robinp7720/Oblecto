import core from '../dist/core/index.js';

core.start();

setTimeout(() => {
    core.close();
}, 1000);
