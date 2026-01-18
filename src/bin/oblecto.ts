#!/usr/bin/env node
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type Runner = (args: string[]) => Promise<void> | void;

type PackageInfo = {
    version?: string;
};

async function run(): Promise<void> {
    try {
        const packageInfo = JSON.parse(await fs.readFile(join(__dirname, '../../package.json'), 'utf8')) as PackageInfo;
        const args = process.argv.slice(2);
        const command = args[0];

        switch (command) {
            case 'start': {
                const { default: core } = await import('../core/index.js');

                core.start();
                break;
            }
            case 'start-tui': {
                const { default: graphical } = await import('../core/graphical.js');

                graphical.start();
                break;
            }
            case 'init': {
                const { default: init } = await import('./scripts/init/index.js');

                await (init as Runner)(args);
                break;
            }
            case 'adduser': {
                const { default: adduser } = await import('./scripts/adduser.js');

                await (adduser as Runner)(args);
                break;
            }
            case 'changepassword': {
                const { default: changepassword } = await import('./scripts/changepassword.js');

                await (changepassword as Runner)(args);
                break;
            }
            case 'removepassword': {
                const { default: removepassword } = await import('./scripts/removepassword.js');

                await (removepassword as Runner)(args);
                break;
            }
            case 'deluser': {
                const { default: deluser } = await import('./scripts/deluser.js');

                await (deluser as Runner)(args);
                break;
            }
            default:
                console.log(`Oblecto ${packageInfo.version ?? ''}`);
                console.log();
                console.log('First time setup:');
                console.log('  oblecto init');
                console.log('  oblecto init database');
                console.log();
                console.log('Start oblecto:');
                console.log('  oblecto start          (Standard mode)');
                console.log('  oblecto start-tui      (TUI mode)');
                console.log();
                console.log('User maintenance:');
                console.log('  oblecto adduser USERNAME PASSWORD REALNAME EMAIL');
                console.log('  oblecto deluser USERNAME');
                console.log('  oblecto changepassword USERNAME PASSWORD');
                console.log('  oblecto removepassword USERNAME');
                console.log();
                console.log('Server maintenance:');
                console.log('  oblecto init assets');
        }
    } catch (e) {
        console.error('An error has occurred: ', e);
        process.exit(1);
    }
}

run();
