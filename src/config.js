export default {
    'indexer': {
        'runAtBoot': false
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
            {
                'path': '/mnt/SMB/TV Shows/'
            }
        ]
    },
    'movies': {
        'directories': [
            {
                'path': '/mnt/SMB/Movies/'
            }
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
        'iso': 'mp4'
    },
    'web': {
        'enabled': true
    }
};