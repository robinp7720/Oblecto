#!/usr/bin/env node
import {promises as fs} from 'fs';

(async () => {
    let packageInfo = JSON.parse(await fs.readFile(__dirname + '/../../package.json'));
    let args = process.argv.slice(2);

    switch (args[0]) {
        case 'start':
            require('../core/index').default.start();
            break;
        case 'start-tui':
            require('../core/graphical').default.start();
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
            console.log('First time setup:');
            console.log('oblecto init');
            console.log('oblecto init database');
            console.log();
            console.log('Start oblecto without TUI:');
            console.log('oblecto start');
            console.log('Start oblecto with TUI:');
            console.log('oblecto start-tui');
            console.log();
            console.log('User maintenance:');
            console.log('oblecto adduser USERNAME PASSWORD REALNAME EMAIL');
            console.log('oblecto deluser USERNAME');
            console.log();
            console.log('Server maintenance:');
            console.log('oblecto init assets');

    }
})();
