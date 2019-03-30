import os from 'os'

let configDefault = {
    'ffmpeg': {
        'pathFFmpeg': '/usr/bin/ffmpeg',
        'pathFFprobe': '/usr/bin/ffprobe'
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
    'mysql': {
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
        'directories': [

        ]
    },
    'movies': {
        'doReIndex': false,
        'directories': [

        ]
    },
    'authentication': {
        'secret': 'secret',
        'saltRounds': 10
    },
    'tracker': {
        'interval': 10
    },
    'transcoding': {
        'doRealTime': true,
        'iso': 'mp4'
    },
    'web': {
        'enabled': true
    }
};

function loadConfig(file) {
    try {
        return require(file)
    } catch (ex) {
        return {}
    }
}

let config = {
    ...configDefault,
    ...loadConfig(__dirname + '/userconfig.json'),
    ...loadConfig('/etc/oblecto/config.json'),
    ...loadConfig(os.homedir() + "/.oblecto.json"),

}

export default config