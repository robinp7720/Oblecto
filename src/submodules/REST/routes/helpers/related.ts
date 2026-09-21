import { QueryTypes, type Sequelize } from 'sequelize';

function genresFrom(raw: unknown): string[] {
    if (typeof raw !== 'string' || !raw.trim()) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    } catch { /* Older libraries store comma-separated genres. */ }
    return raw.split(',').map(value => value.trim()).filter(Boolean);
}

/** Rank in the database; only the twelve selected cards cross the API boundary. */
export async function relatedTitles(sequelize: Sequelize, type: 'movie' | 'series', id: number, genres: unknown): Promise<Record<string, unknown>[]> {
    const movie = type === 'movie';
    const generator = sequelize.getQueryInterface().queryGenerator as { quoteIdentifier(name: string): string };
    const q = (name: string): string => generator.quoteIdentifier(name);
    const table = q(movie ? 'Movies' : 'Series');
    const credits = q(movie ? 'MovieCredits' : 'SeriesCredits');
    const mediaKey = q(movie ? 'movieId' : 'seriesId');
    const allocations = q(movie ? 'MovieSetAllocations' : 'SeriesSetAllocations');
    const sets = q(movie ? 'MovieSets' : 'SeriesSets');
    const allocationMedia = q(movie ? 'MovieId' : 'SeriesId');
    const allocationSet = q(movie ? 'MovieSetId' : 'SeriesSetId');
    const title = q(movie ? 'movieName' : 'seriesName');
    const genreColumn = `m.${q(movie ? 'genres' : 'genre')}`;
    const like = (value: string): string => sequelize.escape(`%${value.replace(/[!%_]/g, '!$&')}%`);
    const csvGenres = `REPLACE(REPLACE(${genreColumn}, ', ', ','), ' ,', ',')`;
    const delimitedGenres = sequelize.getDialect() === 'sqlite' ? `(',' || ${csvGenres} || ',')` : `CONCAT(',', ${csvGenres}, ',')`;
    const genreScore = [...new Set(genresFrom(genres))].map(genre =>
        `(CASE WHEN ${genreColumn} LIKE ${like(JSON.stringify(genre))} ESCAPE '!' OR ${delimitedGenres} LIKE ${like(',' + genre + ',')} ESCAPE '!' THEN 1 ELSE 0 END)`
    ).join(' + ') || '0';
    const collectionScore = `(SELECT COUNT(DISTINCT a.${allocationSet}) FROM ${allocations} a
        JOIN ${allocations} b ON a.${allocationSet} = b.${allocationSet}
        JOIN ${sets} s ON s.${q('id')} = a.${allocationSet}
        WHERE a.${allocationMedia} = m.${q('id')} AND b.${allocationMedia} = :id AND s.${q('public')} = :visible)`;
    const peopleScore = `(SELECT COUNT(DISTINCT c.${q('personId')}) FROM ${credits} c
        JOIN ${credits} d ON c.${q('personId')} = d.${q('personId')}
        WHERE c.${mediaKey} = m.${q('id')} AND d.${mediaKey} = :id)`;
    // Movie collection shelves already display these titles, including private sets returned by the existing endpoint.
    const excludeCollections = movie ? `AND NOT EXISTS (SELECT 1 FROM ${allocations} a JOIN ${allocations} b
        ON a.${allocationSet} = b.${allocationSet} WHERE a.${allocationMedia} = m.${q('id')} AND b.${allocationMedia} = :id)` : '';
    const rows = await sequelize.query<Record<string, unknown>>(`SELECT * FROM (
        SELECT m.*, ${collectionScore} AS ${q('_collections')}, ${peopleScore} AS ${q('_people')},
            (${genreScore}) AS ${q('_genres')}
        FROM ${table} m WHERE m.${q('id')} != :id ${excludeCollections}
    ) ranked WHERE ${q('_collections')} > 0 OR ${q('_people')} > 0 OR ${q('_genres')} > 0
    ORDER BY ${q('_collections')} DESC, ${q('_people')} DESC, ${q('_genres')} DESC, ${title} ASC, ${q('id')} ASC LIMIT 12`, {replacements: { id, visible: true }, type: QueryTypes.SELECT});

    const sourceGenres = new Set(genresFrom(genres).map(value => value.toLocaleLowerCase()));
    const candidateIds = rows.map(row => Number(row.id)).filter(Number.isSafeInteger);
    const sharedPeople = new Map<number, Array<{ id: number; name: string }>>();
    const sharedCollections = new Map<number, Array<{ id: number; name: string }>>();

    // Only the twelve selected candidates are expanded. These are deliberately
    // batched so richer recommendation explanations do not become an N+1 query.
    if (candidateIds.length && Object.hasOwn(sequelize.models, 'Person')) {
        const people = q('People');
        const personRows = await sequelize.query<{ candidateId: number; id: number; name: string }>(`SELECT DISTINCT c.${mediaKey} AS ${q('candidateId')}, p.${q('id')} AS ${q('id')}, p.${q('name')} AS ${q('name')}
            FROM ${credits} c JOIN ${credits} d ON c.${q('personId')} = d.${q('personId')}
            JOIN ${people} p ON p.${q('id')} = c.${q('personId')}
            WHERE d.${mediaKey} = :id AND c.${mediaKey} IN (:candidateIds)
            ORDER BY p.${q('name')} ASC`, { replacements: { id, candidateIds }, type: QueryTypes.SELECT });
        for (const person of personRows) {
            const list = sharedPeople.get(Number(person.candidateId)) ?? [];
            if (list.length < 3) list.push({ id: Number(person.id), name: String(person.name) });
            sharedPeople.set(Number(person.candidateId), list);
        }
    }

    const setModel = sequelize.models[movie ? 'MovieSet' : 'SeriesSet'];
    if (candidateIds.length && setModel !== undefined && Object.hasOwn(setModel.rawAttributes, 'setName')) {
        const collectionRows = await sequelize.query<{ candidateId: number; id: number; name: string }>(`SELECT DISTINCT a.${allocationMedia} AS ${q('candidateId')}, s.${q('id')} AS ${q('id')}, s.${q('setName')} AS ${q('name')}
            FROM ${allocations} a JOIN ${allocations} b ON a.${allocationSet} = b.${allocationSet}
            JOIN ${sets} s ON s.${q('id')} = a.${allocationSet}
            WHERE b.${allocationMedia} = :id AND a.${allocationMedia} IN (:candidateIds) AND s.${q('public')} = :visible
            ORDER BY s.${q('setName')} ASC`, {
                replacements: {
                    id, candidateIds, visible: true
                },
                type: QueryTypes.SELECT
            });
        for (const collection of collectionRows) {
            const list = sharedCollections.get(Number(collection.candidateId)) ?? [];
            if (list.length < 2) list.push({ id: Number(collection.id), name: String(collection.name) });
            sharedCollections.set(Number(collection.candidateId), list);
        }
    }

    return rows.map(({ _collections: _c, _people: _p, _genres: _g, ...item }) => ({
        ...item,
        relationship: {
            sharedCollections: sharedCollections.get(Number(item.id)) ?? [],
            sharedPeople: sharedPeople.get(Number(item.id)) ?? [],
            sharedGenres: genresFrom(item[movie ? 'genres' : 'genre'])
                .filter(value => sourceGenres.has(value.toLocaleLowerCase())).slice(0, 3)
        }
    }));
}
