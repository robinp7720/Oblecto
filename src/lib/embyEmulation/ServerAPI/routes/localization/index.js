export default (server, embyEmulation) => {
    server.get('/localization/options', async (req, res) => {
        res.send([
            { Name: 'English', Value: 'en' },
            { Name: 'English (United States)', Value: 'en-US' }
        ]);
    });

    server.get('/localization/cultures', async (req, res) => {
        res.send([
            {
                Name: 'en-US',
                DisplayName: 'English (United States)',
                TwoLetterISOLanguageName: 'en',
                ThreeLetterISOLanguageName: 'eng',
                ThreeLetterISOLanguageNames: ['eng']
            }
        ]);
    });

    server.get('/localization/countries', async (req, res) => {
        res.send([
            {
                Name: 'United States',
                DisplayName: 'United States',
                TwoLetterISORegionName: 'US',
                ThreeLetterISORegionName: 'USA'
            }
        ]);
    });
};
