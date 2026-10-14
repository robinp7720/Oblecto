import { Movie } from '../../models/movie.js';
import { UserWatchlist } from '../../models/userWatchlist.js';

const available = (): boolean => Boolean(UserWatchlist.sequelize && UserWatchlist.sequelize === Movie.sequelize);

export async function isWatchlisted(userId: number, movieId: number): Promise<boolean> {
    if (!available()) return false;
    return Boolean(await UserWatchlist.findOne({ where: { userId, movieId }, attributes: ['id'] }));
}

export async function setWatchlisted(userId: number, movieId: number, watchlist: boolean): Promise<void> {
    const where = { userId, movieId };
    if (watchlist) await UserWatchlist.findOrCreate({ where, defaults: where });
    else await UserWatchlist.destroy({ where });
}

/** A subquery keeps pagination and facets scoped to the signed-in user's list. */
export function watchlistIdsSql(userId: number): string {
    const sequelize = UserWatchlist.sequelize;
    if (!available() || !sequelize) return '(SELECT NULL WHERE 1 = 0)';
    const generator = sequelize.getQueryInterface().queryGenerator as { quoteIdentifier(name: string): string };
    const q = (name: string): string => generator.quoteIdentifier(name);
    return `(SELECT ${q('movieId')} FROM ${q(UserWatchlist.getTableName() as string)} WHERE ${q('userId')} = ${Number(userId)})`;
}
