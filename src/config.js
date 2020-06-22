import os from 'os'
import fs from 'fs'

let configDefault = {
    'ffmpeg': {

    },
    'indexer': {
        'runAtBoot': false
    },
    'cleaner': {
      'runAtBoot': true
    },
    'mdns': {
        'enable': false
    },
    'queue': {
        'concurrency': 1
    },
    'tvdb': {
        'key': '4908EBCEE2556E3D'
    },
    'assets': {
        'storeWithFile': false,
        'episodeBannerLocation': '/etc/oblecto/assets/episodeBanners/',
        'showPosterLocation': '/etc/oblecto/assets/showPosters/',
        'moviePosterLocation': '/etc/oblecto/assets/moviePosters/',
        'movieFanartLocation': '/etc/oblecto/assets/movieFanart/'
    },
    'themoviedb': {
        'key': 'b06b4917705eeed4e4b273d4c90fe158'
    },
    'database': {
        'dialect': 'sqlite',
        'host': 'localhost',
        'username': 'root',
        'password': 'root',
        'database': 'Oblecto'
    },
    'server': {
        'port': 8080
    },
    'tvshows': {
        'doReIndex': false,
        'ignoreSeriesMismatch': true,
        'indexBroken': false,
        'directories': [

        ]
    },
    'movies': {
        'doReIndex': false,
        'indexBroken': false,
        'directories': [

        ]
    },
    'artwork': {
        'fanart': {
            'small': 100,
            'medium': 500,
            'large': 1000
        },
        'poster': {
            'small': 100,
            'medium': 500,
            'large': 1000
        },
        'banner': {
            'small': 100,
            'medium': 500,
            'large': 1000
        }
    },
    'fileExtensions': {
      'video': ['.mp4','.avi', '.iso', '.m4v', '.mkv', '.mk3d']
    },
    'authentication': {
        'secret': 'secret',
        'saltRounds': 10
    },
    'tracker': {
        'interval': 10
    },
    'transcoding': {
        'doRealTimeRemux': true,
        'doRealTimeTranscode': true,
        'transcodeEverything': false,
        'iso': 'mp4'
    },
    'web': {
        'enabled': true
    },
    'federation': {
        'key': '/etc/oblecto/id_rsa',
        'dataPort': 9131,
        'mediaPort': 9132,
        'servers' : {
            'oblecto': {
                'address': 'oblecto',
                'ca': '/etc/oblecto/keys/oblecto.pem',
                'dataPort': 9131,
                'mediaPort': 9132
            }
        },
        'clients': {
            'tria': {
                'key': '/etc/oblecto/keys/tria.pub'
            }
        }
    }
};

let config = {};

const ConfigManager = {
    loadFile: function loadFile (file) {
        try {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (ex) {
            if (ex.code === 'ENOENT') {
                console.log(`No config file at ${file}, continuing to next file`);

                return {};
            }
            console.log(`There is an error with the config file located at ${file}:`);
            console.log(ex.message);
            return {};
        }
    },
    loadConfigFiles: function loadConfigs () {
        config = {
            ...configDefault,
            ...this.loadFile('/etc/oblecto/config.json'),
            ...this.loadFile(os.homedir() + "/.oblecto.json"),
            ...this.loadFile(__dirname + '/userconfig.json'),
        }
    },
    saveConfig: function saveConfig () {
        fs.writeFile('/etc/oblecto/config.json', JSON.stringify(config, null, 4), (stat, err) => {
            if (err) {
                console.log('An error has occurred while writing the config file: ', err)
            }
        });
    }
};

ConfigManager.loadConfigFiles();

export default config

export { ConfigManager }

