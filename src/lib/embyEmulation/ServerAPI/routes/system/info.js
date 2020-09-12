export default (server, embyEmulation) => {
    server.get('/system/info/public', async (req, res, next) => {
        res.send({
            'LocalAddress': 'http://oblecto:8096',
            'ServerName': 'jellyfin',
            'Version': '10.6.4',
            'ProductName': 'Jellyfin Server',
            'OperatingSystem': 'Linux',
            'Id': embyEmulation.serverId
        });

        next();
    });

    server.get('/system/info', async (req, res, next) => {
        res.send({
            'OperatingSystemDisplayName': 'Linux',
            'HasPendingRestart': false,
            'IsShuttingDown': false,
            'SupportsLibraryMonitor': false,
            'WebSocketPortNumber': 8096,
            'CompletedInstallations': [],
            'CanSelfRestart': false,
            'CanLaunchWebBrowser': false,
            'ProgramDataPath': '/config/data',
            'WebPath': '/usr/share/jellyfin/web',
            'ItemsByNamePath': '/config/data/metadata',
            'CachePath': '/config/cache',
            'LogPath': '/config/log',
            'InternalMetadataPath': '/config/data/metadata',
            'TranscodingTempPath': '/config/data/transcodes',
            'HasUpdateAvailable': false,
            'EncoderLocation': 'Custom',
            'SystemArchitecture': 'X64',
            'LocalAddress': 'http://172.20.0.13:8096',
            'ServerName': embyEmulation.serverName,
            'Version': embyEmulation.version,
            'OperatingSystem': 'Linux',
            'Id': '79d44cdaf63d4e0ab91fca60b8e4b6d6'
        });

        next();
    });
};
