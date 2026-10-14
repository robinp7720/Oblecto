import { Series } from '../../models/series.js';
import { UserSeriesWatchlist } from '../../models/userSeriesWatchlist.js';

const available = (): boolean => Boolean(UserSeriesWatchlist.sequelize && UserSeriesWatchlist.sequelize === Series.sequelize);

export async function isWatchlisted(userId: number, seriesId: number): Promise<boolean> {
    if (!available()) return false;
    return Boolean(await UserSeriesWatchlist.findOne({ where: { userId, seriesId }, attributes: ['id'] }));
}

export async function setWatchlisted(userId: number, seriesId: number, watchlist: boolean): Promise<void> {
    const where = { userId, seriesId };
    if (watchlist) await UserSeriesWatchlist.findOrCreate({ where, defaults: where });
    else await UserSeriesWatchlist.destroy({ where });
}

/** A subquery keeps pagination and facets scoped to the signed-in user's list. */
export function watchlistIdsSql(userId: number): string {
    const sequelize = UserSeriesWatchlist.sequelize;
    if (!available() || !sequelize) return '(SELECT NULL WHERE 1 = 0)';
    const generator = sequelize.getQueryInterface().queryGenerator as { quoteIdentifier(name: string): string };
    const q = (name: string): string => generator.quoteIdentifier(name);
    return `(SELECT ${q('seriesId')} FROM ${q(UserSeriesWatchlist.getTableName() as string)} WHERE ${q('userId')} = ${Number(userId)})`;
}
