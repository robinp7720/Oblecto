#!/usr/bin/env node
require('@babel/polyfill');

var config = require(__dirname + '/../dist/config.js').default;
var oblectoPackage = require(__dirname + '/../package.json');

var args = process.argv.slice(2);

switch (args[0]) {
case 'start':
    require('../dist/');
    break;
case 'adduser':
    var databases = require('../dist/submodules/database');
    var bcrypt = require('bcrypt');

    bcrypt.hash(args[2], config.authentication.saltRounds).then(function (passwordHash) {

        return databases.user.findOrCreate({
            where: {
                username: args[1]
            },
            defaults: {
                name: args[3],
                email: args[4],
                password: passwordHash
            }
        });
    }).then(function(result) {
        if (!result[1]) {
            console.log("A user with that username already exists!")
        }
    }).finally(function () {
        databases.sequelize.close();
    });

    break;
case 'deluser':
    break;
case 'index':
    break;
case 'downloadart':
    break;
default:
    console.log(`Oblecto version ${oblectoPackage.version}`);
    console.log();
    console.log('Usage:');
    console.log('oblecto start');
    console.log('oblecto adduser USERNAME PASSWORD REALNAME EMAIL');
    console.log('oblecto deluser USERNAME');
    console.log('oblecto index [all|tvshows|movies]');
    console.log('oblecto downloadart [all|tvshows|movies]');

}