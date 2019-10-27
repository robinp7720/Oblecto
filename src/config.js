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
        'episodeBannerLocation': 'assets/episodeBanners/',
        'showPosterLocation': 'assets/showPosters/',
        'moviePosterLocation': 'assets/moviePosters/',
        'movieFanartLocation': 'assets/movieFanart/'
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
        'doRealTimeTranscode': false,
        'iso': 'mp4'
    },
    'web': {
        'enabled': true
    }
};

let config = {}

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
        fs.writeFile(__dirname + '/userconfig.json', JSON.stringify(config, null, 4), (stat, err) => {
            if (err) {
                console.log('An error has occurred while writing the config file: ', err)
            }
        });
    }
};

ConfigManager.loadConfigFiles()

export default config

export { ConfigManager }

