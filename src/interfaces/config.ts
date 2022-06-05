interface IConfig {
    'ffmpeg': {},
    'indexer': {
        'runAtBoot': boolean
    },
    'cleaner': {
        'runAtBoot': boolean
    },
    'mdns': {
        'enable': boolean
    },
    'queue': {
        'concurrency': number
    },
    'tvdb': {
        'key': string
    },
    'themoviedb': {
        'key': string
    },
    'fanart.tv': {
        'key': string
    },
    'assets': {
        'storeWithFile': boolean,
        'episodeBannerLocation': string,
        'showPosterLocation': string,
        'moviePosterLocation': string,
        'movieFanartLocation': string
    },
    'database': {
        'dialect': string,
        'host': string,
        'username': string,
        'password': string,
        'database': string
    },
    'server': {
        'port': number
    },
    'tvshows': {
        'seriesIdentifiers': [
            string
        ],
        'episodeIdentifiers': [
            string
        ],
        'seriesUpdaters': [
            string
        ],
        'episodeUpdaters': [
            string
        ],
        'doReIndex': boolean,
        'ignoreSeriesMismatch': boolean,
        'indexBroken': boolean,
        'directories': [string]
    },
    'movies': {
        'movieIdentifiers': [
            string
        ],
        'movieUpdaters': [
            string
        ],
        'doReIndex': boolean,
        'indexBroken': boolean,
        'directories': [string]
    },
    'files': {
        'doHash': true
    },
    'artwork': {
        'fanart': {
            'small': number,
            'medium': number,
            'large': number
        },
        'poster': {
            'small': number,
            'medium': number,
            'large': number
        },
        'banner': {
            'small': number,
            'medium': number,
            'large': number
        }
    },
    'fileExtensions': {
        'video': [
string
        ]
    },
    'authentication': {
        'secret': string,
        'saltRounds': number,
        'allowPasswordlessLogin': boolean
    },
    'tracker': {
        'interval': number
    },
    'transcoding': {
        'transcodeEverything': boolean,
        'hardwareAcceleration': boolean,
        'hardwareAccelerator': string
    },
    'web': {
        'enabled': boolean
    },
    'streaming': {
        'defaultTargetLanguageCode': string
    },
    'federation': {
        'key': string,
        'dataPort': number,
        'mediaPort': number,
        'enable': boolean,
        'servers': {
            'oblecto': {
                'address': string,
                'ca': string,
                'dataPort': number,
                'mediaPort': number
            }
        },
        'clients': {
            'tria': {
                'key': string
            }
        },
        'uuid': string
    },
    'seedboxes': [
        {
            'name': string,
            'storageDriver': string,
            'storageDriverOptions': {
                'host': string,
                'port': number,
                'username': string,
                'password': string
            },
            'mediaImport': {
                'movieDirectory': string,
                'seriesDirectory': string
            },
            'automaticImport': boolean,
            'deleteOnImport': boolean,
            'enabled': boolean
        }
    ]

}
