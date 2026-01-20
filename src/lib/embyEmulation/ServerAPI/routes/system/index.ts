import ping from './ping';
import info from './info';

import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';

export default (server: Application, embyEmulation: EmbyEmulation): void => {
    ping(server, embyEmulation);
    info(server, embyEmulation);

    server.get('/system/endpoint', (_req: Request, res: Response) => {
        res.send({
            IsLocal: true,
            IsInNetwork: true
        });
    });

    server.get('/System/ActivityLog/Entries', (_req: Request, res: Response) => {
        res.send({
            'Items': [
                {
                    'Id': 73, 'Name': 'robin is online from Tria', 'ShortOverview': 'IP address: 192.168.176.23', 'Type': 'SessionStarted', 'Date': '2023-09-01T21:44:45.6801443Z', 'UserId': '028c5cba37874cfa99d5c2089ff75599', 'Severity': 'Information'
                }, {
                    'Id': 72, 'Name': 'robin has disconnected from Tria', 'ShortOverview': 'IP address: 192.168.176.23', 'Type': 'SessionEnded', 'Date': '2023-09-01T21:44:17.5099232Z', 'UserId': '028c5cba37874cfa99d5c2089ff75599', 'Severity': 'Information'
                }, {
                    'Id': 71, 'Name': 'robin has finished playing The Pod Generation on Tria', 'Type': 'VideoPlaybackStopped', 'Date': '2023-09-01T21:40:16.3516098Z', 'UserId': '028c5cba37874cfa99d5c2089ff75599', 'Severity': 'Information'
                }, {
                    'Id': 70, 'Name': 'robin is playing The Pod Generation on Tria', 'Type': 'VideoPlayback', 'Date': '2023-09-01T21:34:32.5569758Z', 'UserId': '028c5cba37874cfa99d5c2089ff75599', 'Severity': 'Information'
                }, {
                    'Id': 69, 'Name': 'robin is online from Tria', 'ShortOverview': 'IP address: 192.168.176.23', 'Type': 'SessionStarted', 'Date': '2023-09-01T21:34:26.9833616Z', 'UserId': '028c5cba37874cfa99d5c2089ff75599', 'Severity': 'Information'
                }, {
                    'Id': 68, 'Name': 'robin is online from Tria', 'ShortOverview': 'IP address: 192.168.176.23', 'Type': 'SessionStarted', 'Date': '2023-09-01T21:34:26.9754616Z', 'UserId': '028c5cba37874cfa99d5c2089ff75599', 'Severity': 'Information'
                }, {
                    'Id': 67, 'Name': 'robin is online from Firefox', 'ShortOverview': 'IP address: 192.168.176.23', 'Type': 'SessionStarted', 'Date': '2023-09-01T20:57:07.9534326Z', 'UserId': '028c5cba37874cfa99d5c2089ff75599', 'Severity': 'Information'
                }
            ],
            'TotalRecordCount': 33,
            'StartIndex': 0
        });
    });

    server.get('/system/configuration', (_req: Request, res: Response) => {
        res.send({
            ServerName: embyEmulation.serverName,
            CachePath: '/config/cache',
            MetadataPath: '/config/data/metadata',
            MetadataCountryCode: 'US',
            PreferredMetadataLanguage: 'en',
            UICulture: 'en-US',
            QuickConnectAvailable: false,
            IsStartupWizardCompleted: true,
            EnableFolderView: false,
            EnableGroupingMoviesIntoCollections: true,
            EnableGroupingShowsIntoCollections: true,
            DisplaySpecialsWithinSeasons: true,
            EnableLegacyAuthorization: false,
            EnableCaseSensitiveItemIds: false,
            EnableNormalizedItemByNameIds: true,
            ImageSavingConvention: 'Compatible',
            ImageExtractionTimeoutMs: 15000,
            LibraryMonitorDelay: 60,
            LibraryUpdateDuration: 300,
            LibraryMetadataRefreshConcurrency: 1,
            LibraryScanFanoutConcurrency: 1,
            LogFileRetentionDays: 7,
            ActivityLogRetentionDays: 7,
            MinResumePct: 5,
            MaxResumePct: 90,
            MinResumeDurationSeconds: 300,
            MinAudiobookResume: 5,
            MaxAudiobookResume: 5,
            InactiveSessionThreshold: 0,
            DummyChapterDuration: 0,
            RemoteClientBitrateLimit: 0,
            SaveMetadataHidden: false,
            EnableExternalContentInSuggestions: false,
            EnableSlowResponseWarning: false,
            SlowResponseThresholdMs: 5000,
            IsPortAuthorized: true,
            CastReceiverApplications: [],
            PathSubstitutions: [],
            MetadataOptions: [],
            PluginRepositories: [],
            CodecsUsed: [],
            ContentTypes: [],
            CorsHosts: [],
            SortRemoveCharacters: [],
            SortRemoveWords: [],
            SortReplaceCharacters: []
        });
    });

    server.get('/system/configuration/metadata', (_req: Request, res: Response) => {
        res.send({
            EnableLocalMetadata: true,
            EnableEmbeddedTitles: true,
            EnableEmbeddedOverview: true,
            EnableEmbeddedRatings: true,
            EnableImageExtraction: true,
            UseFileCreationTimeForDateAdded: false,
            PeopleLimit: 0,
            MetadataOptions: []
        });
    });

    server.get('/system/configuration/xbmcmetadata', (_req: Request, res: Response) => {
        res.send({
            EnablePathSubstitution: false,
            EnableEpisodeTitleString: false,
            EnableSeriesInfo: true
        });
    });

    server.get('/system/configuration/encoding', (_req: Request, res: Response) => {
        res.send({
            EncodingThreadCount: 0,
            EnableFallbackFont: true,
            FallbackFontPath: '',
            FontWhitelist: [],
            EnableHardwareEncoding: false,
            HardwareAccelerationType: 'none',
            H264Crf: 23,
            H265Crf: 28,
            EncoderPreset: 'veryfast',
            AllowStreamCopy: true,
            EnableEnhancedNvdecDecoder: false,
            EnableTonemapping: false
        });
    });

    // TODO: Implement missing System routes
    server.get('/system/configuration/branding', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.get('/system/configuration/metadataoptions/default', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.get('/system/logs', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.get('/system/logs/log', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.post('/system/restart', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.post('/system/shutdown', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    // Note: /system/configuration/:key must be last to avoid capturing specific paths
    server.get('/system/configuration/:key', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    // TODO: Implement Backup routes
    server.get('/backup', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.post('/backup/create', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.get('/backup/manifest', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.post('/backup/restore', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    // TODO: Implement ClientLog routes
    server.post('/clientlog/document', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

};
