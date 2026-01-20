import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';

export default (server: Application, _embyEmulation: EmbyEmulation): void => {
    server.get('/localization/options', (_req: Request, res: Response) => {
        res.send([
            { Name: 'English', Value: 'en' },
            { Name: 'English (United States)', Value: 'en-US' }
        ]);
    });

    server.get('/localization/cultures', (_req: Request, res: Response) => {
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

    server.get('/localization/countries', (_req: Request, res: Response) => {
        res.send([
            {
                Name: 'United States',
                DisplayName: 'United States',
                TwoLetterISORegionName: 'US',
                ThreeLetterISORegionName: 'USA'
            }
        ]);
    });

    server.get('/localization/parentalratings', (_req: Request, res: Response) => { res.send([]); });
};
