import { literal, Op, type Sequelize, type WhereOptions } from 'sequelize';
import { MovieSet } from '../../models/movieSet.js';
import { SeriesSet } from '../../models/seriesSet.js';

/** Public sets and private sets explicitly shared with the caller, without an administrator bypass. */
function visibleSets(sequelize: Sequelize | undefined, kind: 'Movie' | 'Series', userId: number | null): WhereOptions {
    const shared: WhereOptions[] = [];
    const table = `${kind}SetUsers`;

    if (sequelize?.models[table] && userId !== null && Number.isSafeInteger(userId) && userId > 0) {
        const q = (name: string): string => sequelize.getQueryInterface().quoteIdentifier(name);
        shared.push({ id: { [Op.in]: literal(`(SELECT ${q(`${kind}SetId`)} FROM ${q(table)} WHERE ${q('UserId')} = ${userId})`) } });
    }

    return { [Op.or]: [{ public: true }, ...shared] };
}

export const visibleMovieSets = (userId: number | null): WhereOptions => visibleSets(MovieSet.sequelize, 'Movie', userId);
export const visibleSeriesSets = (userId: number | null): WhereOptions => visibleSets(SeriesSet.sequelize, 'Series', userId);
