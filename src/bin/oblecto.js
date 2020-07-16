#!/usr/bin/env node
import {promises as fs} from 'fs';

(async () => {
    let packageInfo = JSON.parse(await fs.readFile(__dirname + '/../../package.json'));
    let args = process.argv.slice(2);

    switch (args[0]) {
        case 'start':
            require('../core').default.start();
            break;

        case 'init':
            await require('./scripts/init').default(args);

            break;

        case 'adduser':
            await require('./scripts/adduser').default(args);

            break;
        case 'deluser':
            await require('./scripts/deluser').default(args);

            break;

        default:
            console.log(`Oblecto ${packageInfo.version}`);
            console.log();
            console.log('Usage:');
            console.log('oblecto init');
            console.log('oblecto init database');
            console.log('oblecto start');
            console.log('oblecto adduser USERNAME PASSWORD REALNAME EMAIL');
            console.log('oblecto deluser USERNAME');

    }
})();
