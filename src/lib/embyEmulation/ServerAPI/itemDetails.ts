// What a page of items needs beyond its own rows: how many seasons and episodes a series holds, how
// many of them this user has watched, and, on a detail page, who is in it.
import { QueryTypes } from 'sequelize';
import { Episode } from '../../../models/episode.js';
import { TrackEpisode } from '../../../models/trackEpisode.js';
import { Person } from '../../../models/person.js';
import { creditsFor } from '../../../submodules/REST/routes/helpers/credits.js';
import { WATCHED_PROGRESS } from '../../playback/progress.js';
import { favouritesAmong, isFavouriteType } from '../../users/favourites.js';
import { TrackMovie } from '../../../models/trackMovie.js';
import { formatId, parseId } from '../helpers.js';

type Dto = Record<string, unknown>;

type SeasonCount = { seriesId: number; season: number; total: number; watched: number };

async function seasonCounts(seriesIds: number[], userId: number | null): Promise<SeasonCount[]> {
    const sequelize = Episode.sequelize;

    if (!sequelize || seriesIds.length === 0) return [];

    const generator = sequelize.getQueryInterface().queryGenerator as { quoteIdentifier(name: string): string };
    const q = (name: string): string => generator.quoteIdentifier(name);
    const episodes = q(Episode.getTableName() as string);
    const tracks = q(TrackEpisode.getTableName() as string);
    const watched = userId
        ? `SUM(CASE WHEN EXISTS (SELECT 1 FROM ${tracks} ${q('t')} WHERE ${q('t')}.${q('episodeId')} = ${q('e')}.${q('id')}
            AND ${q('t')}.${q('userId')} = :userId AND ${q('t')}.${q('progress')} >= :watched) THEN 1 ELSE 0 END)`
        : '0';
    const rows = await sequelize.query<{ seriesId: number; season: string; total: number; watched: number }>(
        `SELECT ${q('e')}.${q('SeriesId')} AS ${q('seriesId')}, ${q('e')}.${q('airedSeason')} AS ${q('season')},
            COUNT(*) AS ${q('total')}, ${watched} AS ${q('watched')}
        FROM ${episodes} ${q('e')} WHERE ${q('e')}.${q('SeriesId')} IN (:seriesIds)
        GROUP BY ${q('e')}.${q('SeriesId')}, ${q('e')}.${q('airedSeason')}`,
        {
            replacements: {
 seriesIds, userId, watched: WATCHED_PROGRESS 
},
            type: QueryTypes.SELECT
        }
    );

    return rows.map(row => ({
        seriesId: Number(row.seriesId),
        season: parseInt(String(row.season), 10),
        total: Number(row.total),
        watched: Number(row.watched)
    }));
}

const applyCounts = (dto: Dto, children: number, total: number, watched: number): void => {
    const userData = dto.UserData as Record<string, unknown>;
    const unplayed = total - watched;

    dto.ChildCount = children;
    dto.RecursiveItemCount = total;
    userData.UnplayedItemCount = unplayed;
    userData.Played = total > 0 && unplayed === 0;
    userData.PlayedPercentage = total > 0 ? watched / total * 100 : 0;
};

/**
 * Fill in which items in a page are this user's favourites, and the folder counts and watch state
 * of its series and seasons, with a query or two for the whole page.
 */
export async function decorateItems(items: Dto[], userId: number | null): Promise<Dto[]> {
    const parsed = items.map(dto => ({ dto, ...parseId(dto.Id) }));
    const favourites = await favouritesAmong(userId, parsed);

    for (const entry of parsed) {
        const userData = entry.dto.UserData as Record<string, unknown> | undefined;

        if (userData) userData.IsFavorite = favourites.has(`${entry.type}:${entry.id}`);
    }

    const folders = parsed.filter(entry => (entry.type === 'series' || entry.type === 'season') && Number.isFinite(entry.id));

    if (folders.length === 0) return items;

    const seriesOf = (entry: { type: string; id: number }): number => (entry.type === 'series' ? entry.id : Math.floor(entry.id / 1000));
    const counts = await seasonCounts([...new Set(folders.map(seriesOf))], userId);

    for (const entry of folders) {
        const seriesId = seriesOf(entry);

        if (entry.type === 'series') {
            const seasons = counts.filter(count => count.seriesId === seriesId);

            applyCounts(entry.dto, seasons.length, seasons.reduce((sum, count) => sum + count.total, 0), seasons.reduce((sum, count) => sum + count.watched, 0));
        } else {
            const season = counts.find(count => count.seriesId === seriesId && count.season === entry.id % 1000);

            applyCounts(entry.dto, season?.total ?? 0, season?.total ?? 0, season?.watched ?? 0);
        }
    }

    return items;
}

// Crew jobs Jellyfin has a person type for; other crew is left out of the People list.
const CREW_TYPES: Array<[RegExp, string]> = [
    [/^director$/i, 'Director'],
    [/^(creator|series creator)$/i, 'Creator'],
    [/writer|screenplay|teleplay|story|novel|author/i, 'Writer'],
    [/producer/i, 'Producer'],
    [/composer|music/i, 'Composer'],
    [/^editor$/i, 'Editor']
];

type Credit = {
    person?: { id?: number; name?: string };
    creditType?: string;
    character?: string | null;
    job?: string | null;
    department?: string | null;
};

/** The cast and key crew of a movie, series or episode, as Jellyfin BaseItemPerson entries. */
export async function peopleFor(type: string, id: number): Promise<Dto[]> {
    const mediaType = type === 'season' ? 'series' : type;
    const mediaId = type === 'season' ? Math.floor(id / 1000) : id;

    if (mediaType !== 'movie' && mediaType !== 'series' && mediaType !== 'episode') return [];
    // Credits only mean anything next to the media they belong to
    if (!Person.sequelize || Person.sequelize !== Episode.sequelize) return [];

    const { cast, crew } = await creditsFor(mediaType, mediaId, Episode.sequelize) as { cast: Credit[]; crew: Credit[] };
    const personIds = [...cast, ...crew].map(credit => Number(credit.person?.id)).filter(Number.isSafeInteger);
    const withProfile = new Set((await Person.findAll({ where: { id: personIds }, attributes: ['id', 'profilePath'] }))
        .filter(person => person.profilePath)
        .map(person => person.id));

    const entry = (credit: Credit, personType: string, role: string | null | undefined): Dto => {
        const personId = Number(credit.person?.id);

        return {
            Name: credit.person?.name ?? '',
            Id: formatId(personId, 'person'),
            Role: role ?? undefined,
            Type: personType,
            PrimaryImageTag: withProfile.has(personId) ? 'primary' : undefined
        };
    };

    const people = cast.map(credit => entry(credit, 'Actor', credit.character));

    // Grouped credits join several jobs with " / "; each job Jellyfin has a type for is listed once
    for (const credit of crew) {
        const types = new Set<string>();

        for (const job of (credit.job ?? '').split(' / ')) {
            const match = CREW_TYPES.find(([pattern]) => pattern.test(job.trim()));

            if (match) types.add(match[1]);
        }
        if (types.size === 0 && credit.department === 'Writing') types.add('Writer');
        for (const personType of types) people.push(entry(credit, personType, credit.job));
    }

    return people;
}

/** One item for its detail page: the counts a folder has, and who is in it. */
export async function describeItem(dto: Dto, userId: number | null): Promise<Dto> {
    const { id, type } = parseId(dto.Id);

    await decorateItems([dto], userId);
    if (Number.isFinite(id)) dto.People = await peopleFor(type, id);

    return dto;
}

/**
 * The UserItemDataDto for one item: the user's progress on a movie or episode, and whether it is
 * one of their favourites. Null for an id that names no item Oblecto keeps user data for.
 */
export async function userItemData(userId: number | null | undefined, itemId: string): Promise<Dto | null> {
    const { id, type } = parseId(itemId);

    if (!userId || !Number.isFinite(id) || !isFavouriteType(type)) return null;

    const favourite = (await favouritesAmong(userId, [{ type, id }])).size > 0;
    const track = type === 'movie'
        ? await TrackMovie.findOne({ where: { userId, movieId: id } })
        : type === 'episode' ? await TrackEpisode.findOne({ where: { userId, episodeId: id } }) : null;
    const played = (track?.progress ?? 0) >= WATCHED_PROGRESS;

    return {
        PlaybackPositionTicks: played ? 0 : Math.round((track?.time ?? 0) * 10000000),
        PlayCount: played ? 1 : 0,
        IsFavorite: favourite,
        Played: played,
        LastPlayedDate: track?.updatedAt?.toISOString(),
        Key: itemId,
        ItemId: itemId
    };
}
