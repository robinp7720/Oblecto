/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../index.js';

/**
 * @param server - The Express application
 * @param embyEmulation - The EmbyEmulation instance
 */
export default (server: Application, _embyEmulation: EmbyEmulation): void => {
    server.get('/displaypreferences/usersettings', async (req, res) => {
        res.send(
            {
                'Id':'3ce5b65d-e116-d731-65d1-efc4a30ec35c',
                'SortBy':'SortName',
                'RememberIndexing':false,
                'PrimaryImageHeight':250,
                'PrimaryImageWidth':250,
                'CustomPrefs':{
                    'chromecastVersion':'stable','skipForwardLength':'30000','skipBackLength':'10000','enableNextVideoInfoOverlay':'False','tvhome':null,'dashboardTheme':null,'http://192.168.176.55:30013/web/index.htmlmoviecollections':'{\u0022SortBy\u0022:\u0022SortName\u0022,\u0022SortOrder\u0022:\u0022Ascending\u0022}','http://192.168.176.55:30013/web/index.htmlseries':'{\u0022SortBy\u0022:\u0022SortName\u0022,\u0022SortOrder\u0022:\u0022Ascending\u0022}','file:///app/share/jellyfinmediaplayer/web-client/desktop/index.htmltrailers':'{\u0022SortBy\u0022:\u0022SortName\u0022,\u0022SortOrder\u0022:\u0022Ascending\u0022}','file:///app/share/jellyfinmediaplayer/web-client/desktop/index.htmlseries':'{\u0022SortBy\u0022:\u0022SortName\u0022,\u0022SortOrder\u0022:\u0022Ascending\u0022}'
                },
                'ScrollDirection':'Horizontal',
                'ShowBackdrop':true,
                'RememberSorting':false,
                'SortOrder':'Ascending',
                'ShowSidebar':false,
                'Client':'emby'
            });
    });

    server.get('/LiveTv/Programs/Recommended', async (req, res) => {
        res.send(
            {
                'Items':[],'TotalRecordCount':0,'StartIndex':0 
            });
    });

    server.post('/displaypreferences/:displaypreferencesid', async (req, res) => { res.status(204).send(); });
};
