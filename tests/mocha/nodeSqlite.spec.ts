import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DataTypes, Model, Sequelize, UniqueConstraintError, ForeignKeyConstraintError } from 'sequelize';
import nodeSqlite from '../../src/submodules/nodeSqlite.js';

class Thing extends Model {
    declare id: number;
    declare name: string;
    declare season: string;
    declare flag: boolean;
    declare seen: Date | null;
}

class Part extends Model {
    declare thingId: number;
}

describe('SQLite on node:sqlite', () => {
    let directory: string;

    const open = async (storage: string): Promise<Sequelize> => {
        const sequelize = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage, logging: false });

        Thing.init({
            name: { type: DataTypes.STRING, unique: true },
            season: DataTypes.STRING,
            flag: { type: DataTypes.BOOLEAN, defaultValue: false },
            seen: DataTypes.DATE
        }, { sequelize, modelName: 'Thing' });
        Part.init({ thingId: { type: DataTypes.INTEGER, references: { model: 'Things', key: 'id' } } }, { sequelize, modelName: 'Part' });
        await sequelize.sync();

        return sequelize;
    };

    beforeEach(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-sqlite-')); });
    afterEach(() => fs.rm(directory, { recursive: true, force: true }));

    it('stores and reads values the way sqlite3 did', async () => {
        const sequelize = await open(':memory:');
        const seen = new Date('2026-01-02T03:04:05.000Z');
        const thing = await Thing.create({ name: 'a', season: 1 as unknown as string, flag: true, seen });
        const read = await Thing.findByPk(thing.id);

        assert.equal(read?.flag, true);
        assert.equal(read?.seen?.toISOString(), seen.toISOString());
        // A whole number in a text column stays "1", not "1.0", so equality filters keep matching.
        assert.equal(read?.season, '1');
        assert.equal(await Thing.count({ where: { season: 1 as unknown as string } }), 1);
        await sequelize.close();
    });

    it('reports insert ids, including for bulk inserts', async () => {
        const sequelize = await open(':memory:');
        const [first, second] = await Thing.bulkCreate([{ name: 'x' }, { name: 'y' }]);

        assert.ok(first.id > 0);
        assert.equal(second.id, first.id + 1);
        await sequelize.close();
    });

    it('turns constraint failures into Sequelize constraint errors', async () => {
        const sequelize = await open(':memory:');

        await Thing.create({ name: 'dup' });
        await assert.rejects(Thing.create({ name: 'dup' }), UniqueConstraintError);
        await assert.rejects(Part.create({ thingId: 999 }), ForeignKeyConstraintError);
        await sequelize.close();
    });

    it('rolls a failed transaction back', async () => {
        const sequelize = await open(':memory:');

        await assert.rejects(sequelize.transaction(async transaction => {
            await Thing.create({ name: 'kept?' }, { transaction });
            throw new Error('abort');
        }), /abort/);
        assert.equal(await Thing.count(), 0);
        await sequelize.close();
    });

    it('keeps data in a database file across reopening', async () => {
        const file = path.join(directory, 'nested', 'db.sqlite');
        const first = await open(file);

        await Thing.create({ name: 'persisted' });
        await first.close();

        const second = await open(file);

        assert.equal((await Thing.findOne())?.name, 'persisted');
        await second.close();
    });
});
