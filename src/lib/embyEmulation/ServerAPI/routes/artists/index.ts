 
import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';
import type { EmbyRequest } from '../../index.js';
import { Op, literal, type WhereOptions } from 'sequelize';
import { Person } from '../../../../../models/person.js';
import { favouriteIdsSql } from '../../../../users/favourites.js';
import { decorateItems } from '../../itemDetails.js';
import { containsText } from '../../../../common/textSearch.js';
import { personProfileFile } from '../../../../people/index.js';
import { formatId } from '../../../helpers.js';
import { formatPerson, resolveLibraryItem } from '../../library.js';
import { requestUserId } from '../../itemQuery.js';
import { getRequestList, getRequestValue } from '../../requestUtils.js';

export default (server: Application, embyEmulation: EmbyEmulation): void => {
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

    // Persons: everyone credited in the library
    server.get('/persons', async (req: EmbyRequest, res: Response) => {
        const startIndex = Math.max(0, Number(getRequestValue(req, 'StartIndex')) || 0);
        const limit = Math.min(Math.max(Number(getRequestValue(req, 'Limit')) || 100, 1), 1000);
        const searchTerm = getRequestValue(req, 'SearchTerm') ?? getRequestValue(req, 'NameStartsWith') ?? '';
        const userId = requestUserId(req);
        const filters = getRequestList(req, 'Filters').map(filter => filter.toLowerCase());
        const favourite = getRequestValue(req, 'IsFavorite') ?? (filters.includes('isfavorite') ? 'true' : undefined);
        const conditions: WhereOptions[] = searchTerm ? [containsText('name', searchTerm)] : [];

        if (favourite !== undefined && userId) {
            conditions.push({ id: { [favourite.toLowerCase() === 'true' ? Op.in : Op.notIn]: literal(favouriteIdsSql(userId, 'person')) } });
        }

        const where = { [Op.and]: conditions };
        const [total, people] = await Promise.all([
            Person.count({ where }),
            Person.findAll({
                where, order: [['name', 'ASC'], ['id', 'ASC']], limit, offset: startIndex
            })
        ]);

        res.send({
            Items: await decorateItems(people.map(person => formatPerson(person, embyEmulation)), userId),
            TotalRecordCount: total,
            StartIndex: startIndex
        });
    });

    const personNamed = (name: string): Promise<Person | null> => Person.findOne({ where: { name }, order: [['id', 'ASC']] });

    server.get('/persons/:name', async (req: EmbyRequest, res: Response) => {
        const person = await personNamed(String(req.params.name));

        if (!person) return res.status(404).send('Not Found');
        res.send(await resolveLibraryItem(formatId(person.id, 'person'), requestUserId(req), embyEmulation));
    });

    const personImage = async (req: Request, res: Response): Promise<void> => {
        const person = await personNamed(String(req.params.name));
        const path = person && String(req.params.imagetype).toLowerCase() === 'primary'
            ? await personProfileFile(embyEmulation.oblecto, person).catch(() => null)
            : null;

        if (path) res.sendFile(path);
        else res.status(404).send('Not Found');
    };

    server.get('/persons/:name/images/:imagetype', personImage);
    server.get('/persons/:name/images/:imagetype/:imageindex', personImage);

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
