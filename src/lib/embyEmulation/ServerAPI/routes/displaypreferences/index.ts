import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';
import type { EmbyRequest } from '../../index.js';
import { JellyfinDisplayPreferences } from '../../../../../models/jellyfinDisplayPreferences.js';
import { User } from '../../../../../models/user.js';
import { getRequestValue } from '../../requestUtils.js';

// Apps save home sections, sort orders and the like here; more than this is not display preferences.
const MAX_BYTES = 64 * 1024;

/** What a Jellyfin server answers before an app has saved anything. */
const defaults = (id: string, client: string): Record<string, unknown> => ({
    Id: id,
    SortBy: 'SortName',
    RememberIndexing: false,
    PrimaryImageHeight: 250,
    PrimaryImageWidth: 250,
    CustomPrefs: id === 'usersettings'
        ? {
            chromecastVersion: 'stable',
            skipForwardLength: '30000',
            skipBackLength: '10000',
            enableNextVideoInfoOverlay: 'False',
            tvhome: null,
            dashboardTheme: null
        }
        : {},
    ScrollDirection: 'Horizontal',
    ShowBackdrop: true,
    RememberSorting: false,
    SortOrder: 'Ascending',
    ShowSidebar: false,
    Client: client
});

// Stored next to the users; a database without the table keeps nothing.
const available = (): boolean => Boolean(JellyfinDisplayPreferences.sequelize && JellyfinDisplayPreferences.sequelize === User.sequelize);

// The id and app a set of preferences is for, whatever the stored or sent copy says
const identified = (preferences: Record<string, unknown>, id: string, client: string): Record<string, unknown> => ({
    ...preferences,
    Id: id,
    Client: client
});

const clientOf = (req: EmbyRequest): string => (getRequestValue(req, 'Client') ?? 'emby').slice(0, 64);

/**
 * @param server - The Express application
 * @param _embyEmulation - The EmbyEmulation instance
 */
export default (server: Application, _embyEmulation: EmbyEmulation): void => {
    // Each user's own, per preferences id and app, as a Jellyfin server keeps them
    server.get('/displaypreferences/:displaypreferencesid', async (req: EmbyRequest, res: Response) => {
        const id = String(req.params.displaypreferencesid).slice(0, 128);
        const client = clientOf(req);
        const stored = available() && req.embyUserId
            ? await JellyfinDisplayPreferences.findOne({
                where: {
                    userId: req.embyUserId,
                    preferencesId: id,
                    client
                }
            })
            : null;

        if (!stored) return res.send(defaults(id, client));

        try {
            res.send(identified(JSON.parse(stored.data) as Record<string, unknown>, id, client));
        } catch {
            res.send(defaults(id, client));
        }
    });

    server.post('/displaypreferences/:displaypreferencesid', async (req: EmbyRequest, res: Response) => {
        const id = String(req.params.displaypreferencesid).slice(0, 128);
        const client = clientOf(req);
        const body = req.body as unknown;

        if (typeof body !== 'object' || body === null || Array.isArray(body)) return res.status(400).send('Expected display preferences');

        const data = JSON.stringify(identified(body as Record<string, unknown>, id, client));

        if (Buffer.byteLength(data) > MAX_BYTES) return res.status(413).send('Display preferences are too large');
        if (!req.embyUserId || !available()) return res.status(204).send();

        const where = {
            userId: req.embyUserId,
            preferencesId: id,
            client
        };
        const [row, created] = await JellyfinDisplayPreferences.findOrCreate({ where, defaults: { ...where, data } });

        if (!created) await row.update({ data });
        res.status(204).send();
    });

    server.get('/LiveTv/Programs/Recommended', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });
};
