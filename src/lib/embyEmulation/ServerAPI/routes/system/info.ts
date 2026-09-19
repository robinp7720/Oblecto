import type { Application, Request, Response } from 'express';
import os from 'node:os';
import type EmbyEmulation from '../../../index.js';

// The address this client reached us on, which is the one it should keep using.
const localAddress = (req: Request): string => `${req.protocol}://${req.get('host') ?? 'localhost'}`;

const OPERATING_SYSTEMS: Record<string, string> = {
    linux: 'Linux',
    darwin: 'Darwin',
    win32: 'Windows'
};

const ARCHITECTURES: Record<string, string> = {
    x64: 'X64',
    arm64: 'Arm64',
    arm: 'Arm',
    ia32: 'X86'
};

const operatingSystem = (): string => OPERATING_SYSTEMS[process.platform] ?? process.platform;

export default (server: Application, embyEmulation: EmbyEmulation): void => {
    server.get('/system/info/public', (req: Request, res: Response) => {
        res.send({
            'LocalAddress': localAddress(req),
            'ServerName': embyEmulation.serverName,
            'Version': embyEmulation.version,
            'ProductName': 'Oblecto Server',
            'OperatingSystem': operatingSystem(),
            'Id': embyEmulation.serverId,
            'StartupWizardCompleted': true
        });
    });

    server.get('/system/info', (req: Request, res: Response) => {
        res.send({
            'OperatingSystemDisplayName': `${operatingSystem()} ${os.release()}`,
            'HasPendingRestart': false,
            'IsShuttingDown': false,
            'SupportsLibraryMonitor': true,
            'WebSocketPortNumber': embyEmulation.oblecto.config.jellyfin.port,
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
            'SystemArchitecture': ARCHITECTURES[process.arch] ?? process.arch,
            'LocalAddress': localAddress(req),
            'ServerName': embyEmulation.serverName,
            'Version': embyEmulation.version,
            'OperatingSystem': operatingSystem(),
            'Id': embyEmulation.serverId
        });
    });

    server.get('/system/info/storage', (req: Request, res: Response) => {
        const baseStorage = {
            DeviceId: 'oblecto',
            StorageType: 'FileSystem',
            FreeSpace: 0,
            UsedSpace: 0
        };

        res.send({
            ProgramDataFolder: {
                Path: '/config/data',
                ...baseStorage
            },
            CacheFolder: {
                Path: '/config/cache',
                ...baseStorage
            },
            LogFolder: {
                Path: '/config/log',
                ...baseStorage
            },
            InternalMetadataFolder: {
                Path: '/config/data/metadata',
                ...baseStorage
            },
            TranscodingTempFolder: {
                Path: '/config/data/transcodes',
                ...baseStorage
            },
            ImageCacheFolder: {
                Path: '/config/cache/images',
                ...baseStorage
            },
            WebFolder: {
                Path: '/usr/share/jellyfin/web',
                ...baseStorage
            },
            Libraries: []
        });
    });
};
