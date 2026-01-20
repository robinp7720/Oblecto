/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/prefer-nullish-coalescing */
import assert from 'node:assert/strict';
import usersRoutes from '../../src/lib/embyEmulation/ServerAPI/routes/users/index.js';
import { Series } from '../../src/models/series.js';
import { Episode } from '../../src/models/episode.js';
import { seriesColumns } from '../../src/models/series.js';
import { episodeColumns } from '../../src/models/episode.js';
import { formatId, formatUuid } from '../../src/lib/embyEmulation/helpers.js';
import { Sequelize } from 'sequelize';

const makeServer = () => {
    const handlers = new Map();

    const register = (method) => (route, handler) => {
        handlers.set(`${method} ${route}`, handler);
    };

    return {
        handlers,
        get: register('GET'),
        post: register('POST'),
        put: register('PUT'),
        delete: register('DELETE')
    };
};

const makeRes = () => {
    const res = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        send(payload) {
            this.body = payload;
            return this;
        }
    };

    return res;
};

describe('Emby users routes - seasons', () => {
    let sequelize;
    let series;
    let ownsSequelize = false;

    before(async () => {
        ownsSequelize = !Series.sequelize;
        sequelize = Series.sequelize || new Sequelize({
            dialect: 'sqlite', storage: ':memory:', logging: false 
        });
        if (ownsSequelize) {
            Series.init(seriesColumns, { sequelize, modelName: 'Series' });
        }
        if (!Episode.sequelize) {
            Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });
        }
        if (!Episode.associations.Series) {
            Episode.belongsTo(Series);
        }
        if (!Series.associations.Episodes) {
            Series.hasMany(Episode);
        }
        await sequelize.sync({ force: true });

        series = await Series.create({ seriesName: 'Test Series' });

        await Episode.create({
            episodeName: 'Pilot',
            airedSeason: '1',
            airedEpisodeNumber: '1',
            SeriesId: series.id
        });
    });

    after(async () => {
        // Keep the shared in-memory DB open for other Emby route tests.
    });

    it('includes SeriesName when listing seasons for a series', async () => {
        const server = makeServer();
        const embyEmulation = { serverId: 'test-server-id' };

        usersRoutes(server, embyEmulation);

        const handler = server.handlers.get('GET /users/:userid/items');
        const req = {
            params: { userid: formatUuid(1) },
            query: {
                IncludeItemTypes: 'Season',
                ParentId: formatId(series.id, 'series')
            }
        };
        const res = makeRes();

        await handler(req, res);

        assert.ok(res.body);
        assert.strictEqual(res.body.Items.length, 1);
        assert.strictEqual(res.body.Items[0].SeriesName, series.seriesName);
    });

    it('includes SeriesName when resolving a season item by id', async () => {
        const server = makeServer();
        const embyEmulation = { serverId: 'test-server-id' };

        usersRoutes(server, embyEmulation);

        const seasonId = series.id * 1000 + 1;
        const handler = server.handlers.get('GET /users/:userid/items/:mediaid');
        const req = {
            params: {
                userid: formatUuid(1),
                mediaid: formatId(seasonId, 'season')
            },
            query: {}
        };
        const res = makeRes();

        await handler(req, res);

        assert.ok(res.body);
        assert.strictEqual(res.body.SeriesName, series.seriesName);
    });
});
