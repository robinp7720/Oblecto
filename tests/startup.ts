/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import core from '../dist/core/index.js';

core.start();

setTimeout(() => {
    core.close();
}, 1000);
