export interface IConfig {
    'ffmpeg': {
        'pathFFmpeg': string | null,
        'pathFFprobe': string | null
    },
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
        'movieFanartLocation': string,
        'userAvatarLocation'?: string
    },
    'database': {
        'dialect': string,
        'host': string,
        'username': string,
        'password': string,
        'database': string,
        'storage'?: string
    },
    'server': {
        'port': number
    },
    // The Jellyfin-compatible API for Jellyfin apps
    'jellyfin': {
        'enabled': boolean,
        'port': number,
        'host': string
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
        'directories': { path: string }[]
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
        'directories': { path: string }[]
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
        // Days a web sign-in lasts before the user must sign in again
        'tokenLifetimeDays'?: number,
        'allowPasswordlessLogin': boolean,
        // Show the profile picker instead of the login form on the local network
        'profilePicker'?: boolean,
        // Let users who opted in sign in without a password on the local network
        'localPasswordlessLogin'?: boolean,
        // CIDRs counted as local on top of loopback, private and link-local ranges
        'localSubnets'?: string[],
        // Take the client address from X-Forwarded-For (only behind a reverse proxy)
        'trustProxy'?: boolean
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
        'defaultTargetLanguageCode': string,
        'hlsMaxSegmentLead'?: number;
        encodingConcurrency?: number;
        maxQueue?: number;
        cacheBytes?: number;
        cacheDirectory?: string;
        idleTimeoutMs?: number;
        vaapiDevice?: string
    },
    'federation': {
        'key': string,
        // TLS certificate presented to federation peers
        'cert'?: string,
        'dataPort': number,
        'mediaPort': number,
        'enable': boolean,
        'servers': Record<string, {
            'address': string,
            'ca': string,
            'dataPort': number,
            'mediaPort': number
        }>,
        'clients': Record<string, {
            'key': string
        }>,
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
    ],
    'seedboxImport': {
        'concurrency': number
    }

}
