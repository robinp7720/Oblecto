import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';

export default (server: Application, _embyEmulation: EmbyEmulation): void => {
    server.get('/web/configurationpages', (req: Request, res: Response) => {
        const enableInMainMenu = String((req.query.enableinmainmenu as string | undefined) ?? (req.query.enableInMainMenu as string | undefined) ?? '').toLowerCase();
        const includeInMenu = enableInMainMenu === '' || enableInMainMenu === 'true';

        res.send([
            {
                Name: 'dashboard',
                EnableInMainMenu: includeInMenu,
                MenuSection: 'Dashboard',
                MenuIcon: 'settings',
                DisplayName: 'Dashboard',
                PluginId: null
            }
        ]);
    });

    server.get('/config.json', (_req: Request, res: Response) => {
        res.send({
            'includeCorsCredentials': false,
            'multiserver': false,
            'themes': [
                {
                    'name': 'Apple TV',
                    'id': 'appletv',
                    'color': '#bcbcbc'
                }, {
                    'name': 'Blue Radiance',
                    'id': 'blueradiance',
                    'color': '#011432'
                }, {
                    'name': 'Dark',
                    'id': 'dark',
                    'color': '#202020',
                    'default': true
                }, {
                    'name': 'Light',
                    'id': 'light',
                    'color': '#303030'
                }, {
                    'name': 'Purple Haze',
                    'id': 'purplehaze',
                    'color': '#000420'
                }, {
                    'name': 'WMC',
                    'id': 'wmc',
                    'color': '#0c2450'
                }
            ],
            'menuLinks': [],
            'servers': [],
            'plugins': [
                'playAccessValidation/plugin',
                'experimentalWarnings/plugin',
                'htmlAudioPlayer/plugin',
                'htmlVideoPlayer/plugin',
                'photoPlayer/plugin',
                'comicsPlayer/plugin',
                'bookPlayer/plugin',
                'youtubePlayer/plugin',
                'backdropScreensaver/plugin',
                'pdfPlayer/plugin',
                'logoScreensaver/plugin',
                'sessionPlayer/plugin',
                'chromecastPlayer/plugin',
                'syncPlay/plugin'
            ]
        });
    });
    server.get('/web/configurationpage', (_req: Request, res: Response) => {
        // Spec says ConfigurationPage, seemingly a file or specific page info?
        // Typically serves HTML or JS.
        res.status(404).send('Not Found');
    });
};
