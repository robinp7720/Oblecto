export default (server, embyEmulation) => {
    server.get('/web/configurationpages', async (req, res) => {
        const enableInMainMenu = (req.query?.enableinmainmenu || req.query?.enableInMainMenu || '').toString().toLowerCase();
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

    server.get('/config.json', async (req, res) => {
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
    server.get('/web/configurationpage', async (req, res) => {
        // Spec says ConfigurationPage, seemingly a file or specific page info?
        // Typically serves HTML or JS.
        res.status(404).send('Not Found');
    });
};
