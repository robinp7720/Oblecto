import { EventEmitter } from 'node:events';
import { Op } from 'sequelize';
import { UserFavourite, FAVOURITE_TYPES, type FavouriteType } from '../../models/userFavourite.js';
import { Movie } from '../../models/movie.js';
import { Episode } from '../../models/episode.js';

export type FavouriteChange = { type: FavouriteType; id: number; favourite: boolean };

/** Emitted after a favourite is saved or removed, with the user id and the change. */
export const favouriteEvents = new EventEmitter();

export const isFavouriteType = (type: string): type is FavouriteType => (FAVOURITE_TYPES as readonly string[]).includes(type);

// Favourites live in the library's database; one without the table set up has none.
const available = (): boolean => Boolean(UserFavourite.sequelize && UserFavourite.sequelize === Movie.sequelize && UserFavourite.sequelize === Episode.sequelize);

/** Mark an item as a favourite of a user, or not. Doing it twice changes nothing. */
export async function setFavourite(userId: number, type: FavouriteType, itemId: number, favourite: boolean): Promise<void> {
    if (favourite) {
        const row = {
            userId,
            itemType: type,
            itemId
        };

        await UserFavourite.findOrCreate({ where: row, defaults: row });
    } else {
        await UserFavourite.destroy({
            where: {
                userId,
                itemType: type,
                itemId
            }
        });
    }

    const change: FavouriteChange = {
        type,
        id: itemId,
        favourite
    };

    favouriteEvents.emit('changed', userId, change);
}

/** Which of these items a user has marked as favourites, as "type:id" keys. One query. */
export async function favouritesAmong(userId: number | null, items: Array<{ type: string; id: number }>): Promise<Set<string>> {
    const wanted = items.filter(item => isFavouriteType(item.type) && Number.isFinite(item.id));

    if (!userId || wanted.length === 0 || !available()) return new Set();

    const rows = await UserFavourite.findAll({
        where: {
            userId,
            [Op.or]: [...new Set(wanted.map(item => item.type))].map(type => ({
                itemType: type,
                itemId: wanted.filter(item => item.type === type).map(item => item.id)
            }))
        },
        attributes: ['itemType', 'itemId']
    });

    return new Set(rows.map(row => `${row.itemType}:${row.itemId}`));
}

/** SQL for the ids of one kind of item a user marked as favourites, for "id IN (…)". */
export function favouriteIdsSql(userId: number, type: FavouriteType): string {
    const sequelize = UserFavourite.sequelize;

    if (!available() || !sequelize) return '(SELECT NULL WHERE 1 = 0)';

    const generator = sequelize.getQueryInterface().queryGenerator as { quoteIdentifier(name: string): string };
    const q = (name: string): string => generator.quoteIdentifier(name);

    return `(SELECT ${q('itemId')} FROM ${q(UserFavourite.getTableName() as string)} WHERE ${q('userId')} = ${Number(userId)} AND ${q('itemType')} = ${sequelize.escape(type)})`;
}
