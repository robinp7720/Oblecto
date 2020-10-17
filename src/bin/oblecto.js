#!/usr/bin/env node
import {promises as fs} from 'fs';
import cliManager from './cliManager';

let CLI = new cliManager();
CLI.registerCommand({
    args: ['init'],
    executePath: './scripts/init/general',
    runType: 'default',
    category: 'First-time Setup',
    description: 'Setup Oblecto'
});
CLI.registerCommand({
    args: ['init', 'database'],
    executePath: './scripts/init/database',
    runType: 'default',
    category: 'First-time Setup',
    description: 'Setup Database'
});
CLI.registerCommand({
    args: ['help'],
    runType: 'help'
});
CLI.registerCommand({
    args: ['start'],
    executePath: '../core/index',
    runType: 'start',
    category: 'Startup',
    description: 'Start Oblecto without the TUI'
});
CLI.registerCommand({
    args: ['start-tui'],
    executePath: '../core/graphical',
    runType: 'start',
    category: 'Startup',
    description: 'Start Oblecto with the TUI'
});
CLI.registerCommand({
    args: ['adduser', '[username]', '[password]', '[realname]', '[email]'],
    executePath: './scripts/adduser',
    runType: 'default',
    category: 'User maintenance',
    description: 'Add user'
});
CLI.registerCommand({
    args: ['deluser', '[username]'],
    executePath: './scripts/deluser',
    runType: 'default',
    category: 'User maintenance',
    description: 'Delete user'
});
CLI.registerCommand({
    args: ['changepassword', '[username]', '[password]'],
    executePath: './scripts/changepassword',
    runType: 'default',
    category: 'User maintenance',
    description: 'Change user password'
});
CLI.registerCommand({
    args: ['removepassword', '[username]'],
    executePath: './scripts/removepassword',
    runType: 'default',
    category: 'User maintenance',
    description: 'Remove user password'
});
CLI.registerCommand({
    args: ['init', 'assets'],
    executePath: './scripts/init/assets',
    runType: 'default',
    category: 'Server maintenance',
    description: 'Create Asset Folders'
});

CLI.execute(process.argv.slice(2));
