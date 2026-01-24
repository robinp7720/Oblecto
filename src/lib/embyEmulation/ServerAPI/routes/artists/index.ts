
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../index.js';

export default (server: Application, _embyEmulation: EmbyEmulation): void => {
    // Artists
    server.get('/artists', (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/artists/albumartists', (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/artists/instantmix', (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/artists/:name', (req, res) => { res.status(404).send('Not Found'); });
    server.get('/artists/:name/images/:imagetype/:imageindex', (req, res) => { res.status(404).send('Not Found'); });
    server.get('/artists/:itemid/instantmix', (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/artists/:itemid/similar', (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });

    // MusicGenres
    server.get('/musicgenres', (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/musicgenres/instantmix', (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/musicgenres/:genrename', (req, res) => { res.status(404).send('Not Found'); });
    server.get('/musicgenres/:name/images/:imagetype', (req, res) => { res.status(404).send('Not Found'); });
    server.get('/musicgenres/:name/images/:imagetype/:imageindex', (req, res) => { res.status(404).send('Not Found'); });
    server.get('/musicgenres/:name/instantmix', (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });

    // Persons
    server.get('/persons', (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/persons/:name', (req, res) => { res.status(404).send('Not Found'); });
    server.get('/persons/:name/images/:imagetype', (req, res) => { res.status(404).send('Not Found'); });
    server.get('/persons/:name/images/:imagetype/:imageindex', (req, res) => { res.status(404).send('Not Found'); });

    // Studios
    server.get('/studios', (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/studios/:name', (req, res) => { res.status(404).send('Not Found'); });
    server.get('/studios/:name/images/:imagetype', (req, res) => { res.status(404).send('Not Found'); });
    server.get('/studios/:name/images/:imagetype/:imageindex', (req, res) => { res.status(404).send('Not Found'); });

    // Albums
    server.get('/albums/:itemid/instantmix', (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/albums/:itemid/similar', (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });

    // Songs
    server.get('/songs/:itemid/instantmix', (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
};
