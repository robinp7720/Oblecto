import type { QueryInterface } from 'sequelize';
import logger from '../logger/index.js';

type Index = {
    name: string;
    unique: boolean;
    primary?: boolean;
    type?: string;
    fields: Array<{ attribute: string; length?: number; order?: string }>;
};
const mediaTables = new Set(['Movies', 'Series', 'Episodes']);
const providerIds = new Set(['tmdbid', 'imdbid', 'tvdbid', 'zap2itid']);

/** Older Sequelize alter-syncs created numbered copies of the same unique provider-id index. */
export async function removeDuplicateLegacyIndexes(query: QueryInterface, table: string): Promise<number> {
    if (!['mysql', 'mariadb'].includes(query.sequelize.getDialect()) || !mediaTables.has(table)) return 0;
    const indexes = await query.showIndex(table) as Index[];
    let removed = 0;
    for (const canonical of indexes) {
        if (!canonical.unique || canonical.primary === true || canonical.fields.length !== 1) continue;
        const field = canonical.fields[0];
        if (!providerIds.has(field.attribute.toLowerCase()) || canonical.name.toLowerCase() !== field.attribute.toLowerCase()) continue;
        for (const candidate of indexes) {
            const prefix = `${canonical.name.toLowerCase()}_`;
            const name = candidate.name.toLowerCase();
            const suffix = name.slice(prefix.length);
            if (!name.startsWith(prefix) || !/^\d+$/.test(suffix) || Number(suffix) < 2) continue;
            if (!candidate.unique || candidate.primary === true || candidate.type !== canonical.type || candidate.fields.length !== 1) continue;
            const duplicate = candidate.fields[0];
            if (duplicate.attribute !== field.attribute || duplicate.length !== field.length || duplicate.order !== field.order) continue;
            logger.info(`Migrating: removing redundant index ${table}.${candidate.name}; retaining ${canonical.name}`);
            await query.removeIndex(table, candidate.name);
            removed++;
        }
    }
    return removed;
}

export function isIndexLimitError(error: unknown): boolean {
    const failure = error as { original?: { code?: string }; parent?: { code?: string } } | null;
    return (failure?.original?.code ?? failure?.parent?.code) === 'ER_TOO_MANY_KEYS';
}
