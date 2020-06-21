#!/usr/bin/env node
import mkdirp from 'mkdirp';
import bcrypt from 'bcrypt';
import uuid from 'node-uuid';
import databases from '../submodules/database';
import {promises as fs} from 'fs';
import NodeRSA from 'node-rsa';

import config from '../config';
import core from '../core';

var args = process.argv.slice(2);

switch (args[0]) {
case 'start':
    core.start();
    break;

case 'init':
    (async () => {

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

        console.log('Creating config file');

        config.federation.uuid = uuid.v4();
        await fs.writeFile('/etc/oblecto/config.json', JSON.stringify(config, null, 4));

        console.log('Generating federation keys');
        const key = new NodeRSA({b: 2048});

        await fs.writeFile('/etc/oblecto/id_rsa', key.exportKey('pkcs1-private-pem'));
        await fs.writeFile('/etc/oblecto/id_rsa.pub', key.exportKey('pkcs1-public-pem'));

    })();

    break;
case 'database':
    (async () => {
        await databases.sequelize.authenticate()
            .then(() => {
                // Create databases if connection to the database could be established
                return databases.sequelize.sync();
            });

        await databases.sequelize.close();
    })();

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
