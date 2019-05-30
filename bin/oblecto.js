#!/usr/bin/env node
require('@babel/polyfill');

var config = require(__dirname + '/../dist/config.js').default;
var oblectoPackage = require(__dirname + '/../package.json');

var args = process.argv.slice(2);

switch (args[0]) {
case 'start':
    require('../dist/');
    break;

case 'init':
    var databases = require('../dist/submodules/database').default;
    databases.sequelize
        .authenticate()
        .then(() => {
            // Create databases if connection to the database could be established
            return databases.sequelize.sync();
        }).finally(function () {
            console.log('Oblecto has been initialized');
            databases.sequelize.close();
        }).catch((err) => {
            console.log('An error has occured while authenticating and/or during table creation:');
            console.log(err);
        });

    break

case 'adduser':
    if (args.length < 5) {
        console.log('Invalid number of arguments')
        return false
    }

    var databases = require('../dist/submodules/database').default;
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
    }).catch(function (err) {
        console.log(err);
    });

    break;
case 'deluser':
    if (args.length < 2) {
        console.log('Invalid number of arguments')
        return false
    }

    var databases = require('../dist/submodules/database').default;

    databases.user.findOne({
        where: {
            username: args[1]
        }
    }).then(function (user) {
        return user.destroy();
    }).finally(function () {
        console.log(`user ${args[1]} has been deleted`);
        databases.sequelize.close();
    });

    break;

default:
    console.log(`Oblecto version ${oblectoPackage.version}`);
    console.log();
    console.log('Usage:');
    console.log('oblecto init')
    console.log('oblecto start');
    console.log('oblecto adduser USERNAME PASSWORD REALNAME EMAIL');
    console.log('oblecto deluser USERNAME');

}