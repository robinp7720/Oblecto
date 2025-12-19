export default (server, embyEmulation) => {
    server.get('/system/info/public', async (req, res) => {
        res.send({
            'LocalAddress': 'http://oblecto:8096',
            'ServerName': embyEmulation.serverName,
            'Version': '10.11.5',
            'ProductName': 'Jellyfin Server',
            'OperatingSystem': 'Linux',
            'Id': embyEmulation.serverId,
            'StartupWizardCompleted':	true
        });
    });

    server.get('/system/info', async (req, res) => {
        console.log('Getting system info');
        res.send({
            'OperatingSystemDisplayName': 'Linux',
            'HasPendingRestart': false,
            'IsShuttingDown': false,
            'SupportsLibraryMonitor': true,
            'WebSocketPortNumber': 9096,
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
            'LocalAddress': 'http://pegasus:9096',
            'ServerName': embyEmulation.serverName,
            'Version': embyEmulation.version,
            'OperatingSystem': 'Linux',
            'Id': '79d44cdaf63d4e0ab91fca60b8e4b6d6'
        });
    });
};
