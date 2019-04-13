#!/usr/bin/env node
require('@babel/polyfill');

var oblectoPackage = require(__dirname + '/../package.json');

var args = process.argv.slice(2);

switch (args[0]) {
    case 'start':
        require('../dist/index.js');
        break;
    case 'adduser':
        break;
    case 'deluser':
        break;
    case 'index':
        break;
    case 'downloadart':
        break;
    default:
        console.log(`Oblecto version ${oblectoPackage.version}`);
        console.log()
        console.log(`Usage:`);
        console.log(`oblecto start`);
        console.log(`oblecto adduser USERNAME PASSWORD REALNAME EMAIL`);
        console.log(`oblecto deluser USERNAME`);
        console.log(`oblecto index [all|tvshows|movies]`);
        console.log(`oblecto downloadart [all|tvshows|movies]`);

}