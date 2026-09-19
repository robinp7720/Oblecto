export interface IConfig {
    'ffmpeg': {
        'pathFFmpeg': string | null,
        'pathFFprobe': string | null
    },
    // Start a full library scan, or a clean-up of missing files, each time Oblecto starts
    'indexer': {
        'runAtBoot': boolean
    },
    'cleaner': {
        'runAtBoot': boolean
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
        'storage'?: string,
        // Update the schema when Oblecto starts; off means refuse to start until `oblecto migrate` has run
        'migrateOnStart'?: boolean
    },
    'server': {
        'port': number,
        // Other web origins allowed to call the APIs from a browser, e.g. "http://localhost:5173"; "*" for any
        'corsOrigins'?: string[]
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
        'directories': { path: string }[]
    },
    'movies': {
        'movieIdentifiers': [
            string
        ],
        'movieUpdaters': [
            string
        ],
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
    'logging'?: {
        // Where error.log and combined.log go; empty means a logs directory beside the config file
        'directory'?: string,
        'level'?: 'error' | 'warn' | 'info' | 'debug',
        // Rotate a log file when it reaches this size, keeping this many
        'maxSizeMB'?: number,
        'maxFiles'?: number,
        // Write log files at all; the console always gets the log
        'file'?: boolean
    },
    'transcoding': {
        'hardwareAcceleration': boolean,
        'hardwareAccelerator': string
    },
    'web': {
        'enabled': boolean
    },
    'streaming': {
        'defaultTargetLanguageCode': string,
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
