#!/usr/bin/env node
import mkdirp from 'mkdirp';
import bcrypt from 'bcrypt';
import databases from '../submodules/database';

import config from '../config';
import core from '../core';

var args = process.argv.slice(2);

switch (args[0]) {
case 'start':
    core.start();
    break;

case 'init':
    // Create directories for image assets
    for (let size in config.artwork.fanart) {
        console.log(`Creating directory ${config.assets.movieFanartLocation}/${size}/`);
        mkdirp(`${config.assets.movieFanartLocation}/${size}`);
    }

    for (let size in config.artwork.poster) {
        console.log(`Creating directory ${config.assets.moviePosterLocation}/${size}/`);
        mkdirp(`${config.assets.moviePosterLocation}/${size}`);
        console.log(`Creating directory ${config.assets.showPosterLocation}/${size}/`);
        mkdirp(`${config.assets.showPosterLocation}/${size}`);
    }

    for (let size in config.artwork.banner) {
        console.log(`Creating directory ${config.assets.episodeBannerLocation}/${size}/`);
        mkdirp(`${config.assets.episodeBannerLocation}/${size}`);
    }

    let size = 'original';

    console.log(`Creating directory ${config.assets.movieFanartLocation}/${size}/`);
    mkdirp(`${config.assets.movieFanartLocation}/${size}`);
    console.log(`Creating directory ${config.assets.moviePosterLocation}/${size}/`);
    mkdirp(`${config.assets.moviePosterLocation}/${size}`);
    console.log(`Creating directory ${config.assets.showPosterLocation}/${size}/`);
    mkdirp(`${config.assets.showPosterLocation}/${size}`);
    console.log(`Creating directory ${config.assets.episodeBannerLocation}/${size}/`);
    mkdirp(`${config.assets.episodeBannerLocation}/${size}`);

    databases.sequelize
        .authenticate()
        .then(() => {
            // Create databases if connection to the database could be established
            return databases.sequelize.sync();
        }).finally(function () {
            console.log('Oblecto has been initialized');
            databases.sequelize.close();
        }).catch((err) => {
            console.log('An error has occurred while authenticating and/or during table creation:');
            console.log(err);
        });

    break;

case 'adduser':
    if (args.length < 5) {
        console.log('Invalid number of arguments');
        break;
    }

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
        console.log('Invalid number of arguments');
        break;
    }

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
    console.log('Oblecto CLI');
    console.log();
    console.log('Usage:');
    console.log('oblecto init');
    console.log('oblecto start');
    console.log('oblecto adduser USERNAME PASSWORD REALNAME EMAIL');
    console.log('oblecto deluser USERNAME');

}
