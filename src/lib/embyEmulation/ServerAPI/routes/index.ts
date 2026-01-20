import system from './system/index.js';
import users from './users/index.js';
import sessions from './sessions/index.js';
import displaypreferences from './displaypreferences/index.js';
import branding from './branding/index.js';
import shows from './shows/index.js';
import items from './items/index.js';
import videos from './videos/index.js';
import quickconnect from './quickconnect/index.js';
import web from './web/index.js';
import localization from './localization/index.js';
import devices from './devices/index.js';
import artists from './artists/index.js';
import channels from './channels/index.js';
import library from './library/index.js';
import media from './media/index.js';
import plugins from './plugins/index.js';
import others from './others/index.js';

import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../index.js';

/**
 *
 * @param server - The Express application
 * @param embyEmulation - The EmbyEmulation instance
 */
export default (server: Application, embyEmulation: EmbyEmulation): void => {
    system(server, embyEmulation);
    users(server, embyEmulation);
    sessions(server, embyEmulation);
    displaypreferences(server, embyEmulation);
    branding(server, embyEmulation);
    shows(server, embyEmulation);
    items(server, embyEmulation);
    videos(server, embyEmulation);
    quickconnect(server, embyEmulation);
    web(server, embyEmulation);
    localization(server, embyEmulation);
    devices(server, embyEmulation);
    artists(server, embyEmulation);
    channels(server, embyEmulation);
    library(server, embyEmulation);
    media(server, embyEmulation);
    plugins(server, embyEmulation);
    others(server, embyEmulation);

    server.get('/', (req: Request, res: Response) => {
        res.redirect('web/');
    });

    server.get('/scheduledtasks', async (req: Request, res: Response) => {
        res.send({});
    });
};
