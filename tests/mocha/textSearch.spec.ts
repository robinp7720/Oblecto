import assert from 'node:assert/strict';
import { DataTypes, Model, Sequelize } from 'sequelize';
import { containsText, startsWithText } from '../../src/lib/common/textSearch.js';

class Title extends Model {
    declare name: string;
}

describe('Text search', () => {
    let sequelize: Sequelize;

    before(async () => {
        sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        Title.init({ name: DataTypes.STRING }, { sequelize, modelName: 'Title' });
        await sequelize.sync();
        await Title.bulkCreate(['Up_Down', 'UpXDown', '100% Wolf', '100 Wolves', 'C:\\Films', '/tv_shows/a.mkv', '/tvXshows/b.mkv'].map(name => ({ name })));
    });

    after(() => sequelize.close());

    const names = async (where: ReturnType<typeof containsText>) => (await Title.findAll({ where, order: [['name', 'ASC']] })).map(title => title.name);

    it('matches _ and % literally, not as wildcards', async () => {
        assert.deepEqual(await names(containsText('name', 'up_')), ['Up_Down']);
        assert.deepEqual(await names(containsText('name', '100%')), ['100% Wolf']);
    });

    it('ignores case and keeps backslashes', async () => {
        assert.deepEqual(await names(containsText('name', 'WOL')), ['100 Wolves', '100% Wolf']);
        assert.deepEqual(await names(containsText('name', 'c:\\f')), ['C:\\Films']);
    });

    it('filters by an exact folder prefix', async () => {
        assert.deepEqual(await names(startsWithText('name', '/tv_shows/')), ['/tv_shows/a.mkv']);
    });
});
