/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unused-vars, @typescript-eslint/prefer-nullish-coalescing */
import { Movie } from '../../../../../models/movie';
import { TrackMovie } from '../../../../../models/trackMovie';
import { File } from '../../../../../models/file';
import { User } from '../../../../../models/user';
import { Stream } from '../../../../../models/stream';
import { formatUuid, parseUuid, parseId, formatMediaItem, formatId, MediaItem } from '../../../helpers';
import { Series } from '../../../../../models/series';
import { Episode } from '../../../../../models/episode';
import { TrackEpisode } from '../../../../../models/trackEpisode';
import logger from '../../../../../submodules/logger/index.js';
import { Op, type Includeable } from 'sequelize';

import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';
import { EmbyRequest } from '../../index.js';
import { getRequestValue } from '../../requestUtils.js';
import { libraryViews } from '../../../views.js';
import { clientAddress, isLocalRequest } from '../../../../network/localNetwork.js';
import { loginThrottle } from '../../../../auth/loginThrottle.js';
import { canSignInWithoutPassword } from '../../../../auth/loginPolicy.js';
import { avatarPath } from '../../../../users/avatars.js';
import { permissionsOf } from '../../../../auth/permissions.js';
import { SubtitleMode, resolvePreferences } from '../../../../users/preferences.js';
import { setPlayed } from '../../../../playback/progress.js';
import { changeOwnPassword, PasswordChangeError } from '../../../../users/password.js';

// Jellyfin clients show their admin dashboard to administrators.
const isAdministrator = async (user: User | null): Promise<boolean> => user !== null && (await permissionsOf(user)).includes('settings.manage');

// Oblecto does not track sign-ins; the last change to the account is the closest honest date.
const lastChanged = (user: User): string => new Date((user as unknown as { updatedAt?: Date }).updatedAt ?? Date.now()).toISOString();

const JELLYFIN_SUBTITLE_MODES: Record<SubtitleMode, string> = {
    off: 'None',
    auto: 'Default',
    forced: 'OnlyForced'
};

const buildUserDto = (user: User, embyEmulation: EmbyEmulation, HasPassword = Boolean(user.password), IsAdministrator = false): Record<string, unknown> => {
    const preferences = resolvePreferences(user.preferences);

    return {
        Name: user.name,
        ServerId: embyEmulation.serverId,
        Id: formatUuid(user.id),
        PrimaryImageTag: user.avatar ?? undefined,
        HasPassword,
        HasConfiguredPassword: HasPassword,
        HasConfiguredEasyPassword: false,
        EnableAutoLogin: false,
        LastLoginDate: lastChanged(user),
        LastActivityDate: lastChanged(user),
        Configuration: {
            PlayDefaultAudioTrack: preferences.audioLanguage === null,
            AudioLanguagePreference: preferences.audioLanguage ?? '',
            SubtitleLanguagePreference: preferences.subtitleLanguage ?? '',
            DisplayMissingEpisodes: false,
            GroupedFolders: [],
            SubtitleMode: JELLYFIN_SUBTITLE_MODES[preferences.subtitleMode],
            DisplayCollectionsView: false,
            EnableLocalPassword: false,
            OrderedViews: [],
            LatestItemsExcludes: [],
            MyMediaExcludes: [],
            HidePlayedInLatest: true,
            RememberAudioSelections: true,
            RememberSubtitleSelections: true,
            EnableNextEpisodeAutoPlay: preferences.autoplayNext
        },
        Policy: {
            IsAdministrator,
            IsHidden: false,
            IsDisabled: false,
            BlockedTags: [],
            EnableUserPreferenceAccess: true,
            AccessSchedules: [],
            BlockUnratedItems: [],
            EnableRemoteControlOfOtherUsers: false,
            EnableSharedDeviceControl: false,
            EnableRemoteAccess: false,
            EnableLiveTvManagement: false,
            EnableLiveTvAccess: false,
            EnableMediaPlayback: true,
            EnableAudioPlaybackTranscoding: false,
            EnableVideoPlaybackTranscoding: false,
            EnablePlaybackRemuxing: true,
            ForceRemoteSourceTranscoding: false,
            EnableContentDeletion: true,
            EnableContentDeletionFromFolders: [],
            EnableContentDownloading: true,
            EnableSyncTranscoding: false,
            EnableMediaConversion: false,
            EnabledDevices: [],
            EnableAllDevices: true,
            EnabledChannels: [],
            EnableAllChannels: true,
            EnabledFolders: [],
            EnableAllFolders: true,
            InvalidLoginAttemptCount: 0,
            LoginAttemptsBeforeLockout: -1,
            MaxActiveSessions: 0,
            EnablePublicSharing: true,
            BlockedMediaFolders: [],
            BlockedChannels: [],
            RemoteClientBitrateLimit: 0,
            AuthenticationProviderId: 'Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider',
            PasswordResetProviderId: 'Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider',
            SyncPlayAccess: 'CreateAndJoinGroups'
        }
    };
};

/**
 *
 * @param server - The Express application
 * @param embyEmulation - The EmbyEmulation instance
 */
export default (server: Application, embyEmulation: EmbyEmulation): void => {
    // The login screen's user tiles: only shown to clients on the local network.
    server.get('/users/public', async (req: Request, res: Response) => {
        const authentication = embyEmulation.oblecto.config.authentication;

        if (authentication.profilePicker === false || !isLocalRequest(req, authentication)) {
            res.send([]);
            return;
        }

        const users = await User.findAll({ where: { publicProfile: true }, order: [['name', 'ASC'], ['username', 'ASC']] });

        // HasPassword false makes jellyfin-web sign in straight from the tile.
        res.send(users.map((user) => buildUserDto(user, embyEmulation, !canSignInWithoutPassword(user, true, authentication))));
    });

    server.get('/users/:userid/images/primary', async (req: Request, res: Response) => {
        const user = await User.findByPk(parseUuid(req.params.userid as string), { attributes: ['id', 'avatar'] });

        if (!user?.avatar) {
            res.status(404).send('Not Found');
            return;
        }

        res.sendFile(avatarPath(embyEmulation.oblecto.config, user.avatar), (error) => {
            if (error && !res.headersSent) res.status(404).send('Not Found');
        });
    });

    server.get('/users', async (req: Request, res: Response) => {
        const users = await User.findAll();
        const admins = await Promise.all(users.map(isAdministrator));

        res.send(users.map((user, index) => buildUserDto(user, embyEmulation, Boolean(user.password), admins[index])));
    });

    server.post('/users/authenticatebyname', async (req: EmbyRequest, res: Response) => {
        const Username = getRequestValue(req, 'Username');
        const Pw = getRequestValue(req, 'Pw');

        if (!Username) {
            res.status(400).send('Missing Username');
            return;
        }

        const authentication = embyEmulation.oblecto.config.authentication;
        const address = clientAddress(req, authentication);
        const wait = loginThrottle.retryAfter(address, Username);

        if (wait > 0) {
            res.set('Retry-After', String(wait)).status(429).send('Too many failed sign-ins');
            return;
        }

        const local = isLocalRequest(req, authentication);
        const client = req.headers.emby ?? {};
        let accessToken: string;

        try {
            accessToken = await embyEmulation.handleLogin(Username, Pw, local, {
                Client: client.Client,
                Device: client.Device,
                DeviceId: client.DeviceId,
                Version: client.Version,
                RemoteEndPoint: req.ip
            });
        } catch {
            // Jellyfin answers a failed sign-in with 401, which clients show as "wrong username or password"
            loginThrottle.failed(address, Username);
            res.status(401).send('Invalid username or password');
            return;
        }

        loginThrottle.succeeded(address, Username);

        const session = embyEmulation.sessions[accessToken];
        const user = await User.findByPk(session.Id);

        if (!user) {
            res.status(401).send('Invalid username or password');
            return;
        }

        const userDto = buildUserDto(user, embyEmulation, session.HasPassword, await isAdministrator(user));

        res.send({
            'User': {
                ...userDto,
                LastLoginDate: session.LastLoginDate,
                LastActivityDate: session.LastActivityDate
            },
            'SessionInfo': {
                'PlayState': {
                    'CanSeek': false, 'IsPaused': false, 'IsMuted': false, 'RepeatMode': 'RepeatNone', 'PlaybackOrder': 'Default'
                },
                'AdditionalUsers': [],
                'Capabilities': {
                    'PlayableMediaTypes': [], 'SupportedCommands': [], 'SupportsMediaControl': false, 'SupportsPersistentIdentifier': true
                },
                'RemoteEndPoint': session.client.RemoteEndPoint ?? '',
                'PlayableMediaTypes': [],
                'Id': session.client.DeviceId ?? accessToken.slice(0, 16),
                'UserId': formatUuid(session.Id),
                'UserName': session.Name,
                'Client': session.client.Client ?? '',
                'LastActivityDate': session.LastActivityDate,
                'LastPlaybackCheckIn': '0001-01-01T00:00:00.0000000Z',
                'DeviceName': session.client.Device ?? '',
                'DeviceId': session.client.DeviceId ?? '',
                'ApplicationVersion': session.client.Version ?? '',
                'IsActive': true,
                'SupportsMediaControl': false,
                'SupportsRemoteControl': false,
                'NowPlayingQueue': [],
                'NowPlayingQueueFullItems': [],
                'HasCustomDeviceName': false,
                'ServerId': session.ServerId,
                'UserPrimaryImageTag': user.avatar ?? undefined,
                'SupportedCommands': []
            },
            'AccessToken': accessToken,
            'ServerId': session.ServerId
        });
    });

    // Always the signed-in user: the session guard pins :userid to them, and "me" resolves the same way.
    server.get('/users/:userid', async (req: EmbyRequest, res: Response) => {
        const user = await User.findByPk(req.embyUserId);

        if (!user) {
            res.status(404).send('User not found');
            return;
        }

        res.send(buildUserDto(user, embyEmulation, Boolean(user.password), await isAdministrator(user)));
    });

    server.get('/users/:userid/views', (req: Request, res: Response) => {
        res.send(libraryViews(embyEmulation.serverId));
    });

    server.get('/users/:userid/items', async (req: EmbyRequest, res: Response) => {
        let items = [];
        const normalizeQueryList = (query: Record<string, any>, ...keys: string[]): string[] => {
            const values: any[] = [];

            for (const key of keys) {
                if (query[key] === undefined) continue;
                const raw = query[key];

                if (Array.isArray(raw)) {
                    for (const entry of raw) {
                        values.push(entry);
                    }
                } else {
                    values.push(raw);
                }
            }
            return values
                .flatMap(value => String(value).split(','))
                .map(value => value.trim())
                .filter(value => value.length > 0);
        };
        const includeItemTypes = normalizeQueryList(req.query as Record<string, any>, 'IncludeItemTypes', 'includeItemTypes', 'includeitemtypes')
            .map(value => value.toLowerCase());
        const searchTerm = getRequestValue(req, 'SearchTerm') || '';
        const startIndex = parseInt(getRequestValue(req, 'StartIndex') || '0', 10) || 0;
        const limit = parseInt(getRequestValue(req, 'Limit') || '100', 10) || 100;
        const parentId = getRequestValue(req, 'ParentId') || '';

        let parsedParentId = null;

        if (parentId) {
            parsedParentId = parseId(parentId);
        }

        if (includeItemTypes.includes('movie')) {
            const count = await Movie.count();

            let where: any = {};

            if (searchTerm) {
                where = { movieName: { [Op.like]: `%${searchTerm}%` } };
            }

            const results = await Movie.findAll({
                where,
                include: [{ model: File, include: [{ model: Stream }] }],
                limit: limit,
                offset: startIndex
            });

            items = results.map(movie => formatMediaItem(movie, 'movie', embyEmulation));

            res.send({
                'Items': items,
                'TotalRecordCount': count,
                'StartIndex': startIndex
            });
        } else if (includeItemTypes.includes('series')) {
            const count = await Series.count();

            let where: any = {};

            if (searchTerm) {
                where = { seriesName: { [Op.like]: `%${searchTerm}%` } };
            }

            const sortBy = normalizeQueryList(req.query as Record<string, any>, 'SortBy', 'sortBy', 'sortby')
                .map(value => value.toLowerCase())
                .join(',');
            const sortOrder = normalizeQueryList(req.query as Record<string, any>, 'SortOrder', 'sortOrder', 'sortorder')
                .map(value => value.toLowerCase())
                .join(',') || 'ascending';
            const order: any[] = [];

            if (sortBy) {
                const parts = sortBy.split(',');

                for (const part of parts) {
                    const direction = sortOrder.startsWith('desc') ? 'DESC' : 'ASC';

                    if (part === 'sortname') {
                        order.push(['seriesName', direction]);
                    } else if (part === 'premieredate' || part === 'productionyear') {
                        order.push(['firstAired', direction]);
                    } else if (part === 'datecreated') {
                        order.push(['createdAt', direction]);
                    }
                }
            }

            if (order.length === 0) {
                order.push(['seriesName', 'ASC']);
            }

            const results = await Series.findAll({
                where,
                limit: limit,
                offset: startIndex,
                order: order
            });

            items = results.map(series => formatMediaItem(series, 'series', embyEmulation));

            res.send({
                'Items': items,
                'TotalRecordCount': count,
                'StartIndex': startIndex
            });
        } else if (includeItemTypes.includes('episode') || (parsedParentId?.type === 'season')) {
            const userId = String(req.params.userid ?? ''); // Route parameter
            const parsedUserId = userId ? parseUuid(userId) : null;
            const where: any = {};

            if (parsedParentId) {
                if (parsedParentId.type === 'series') {
                    where.SeriesId = parsedParentId.id;
                } else if (parsedParentId.type === 'season') {
                    where.SeriesId = Math.floor(parsedParentId.id / 1000);
                    where.airedSeason = parsedParentId.id % 1000;
                }
            }

            if (searchTerm) {
                where.episodeName = { [Op.like]: `%${searchTerm}%` };
            }

            const count = await Episode.count({ where });

            const include = [Series, { model: File, include: [{ model: Stream }] }];

            if (parsedUserId) {
                include.push({
                    model: TrackEpisode,
                    required: false,
                    where: { userId: parsedUserId }
                } as any);
            }

            const results = await Episode.findAll({
                where,
                include,
                limit: limit,
                offset: startIndex,
                order: [['airedSeason', 'ASC'], ['airedEpisodeNumber', 'ASC']]
            });

            items = results.map(ep => formatMediaItem(ep, 'episode', embyEmulation));

            res.send({
                'Items': items,
                'TotalRecordCount': count,
                'StartIndex': startIndex
            });
        } else if (includeItemTypes.includes('season') || (parsedParentId?.type === 'series')) {
            let seriesId = null;

            if (parsedParentId?.type === 'series') {
                seriesId = parsedParentId.id;
            }

            if (!seriesId) {
                return res.send({
                    Items: [], TotalRecordCount: 0, StartIndex: 0
                });
            }

            const series = await Series.findByPk(seriesId);

            if (!series) {
                return res.send({
                    Items: [], TotalRecordCount: 0, StartIndex: 0
                });
            }

            const episodes = await Episode.findAll({
                where: { SeriesId: seriesId },
                attributes: ['airedSeason'],
                order: [['airedSeason', 'ASC']]
            });

            const distinctSeasons = new Set();

            episodes.forEach(ep => distinctSeasons.add(ep.airedSeason));

            items = [];
            const sortedSeasons = Array.from(distinctSeasons).sort((a: any, b: any) => Number(a) - Number(b));

            const pagedSeasons = sortedSeasons.slice(startIndex, startIndex + limit);

            for (const seasonNum of pagedSeasons as any[]) {
                const pseudoId = seriesId * 1000 + parseInt(String(seasonNum), 10);
                const seasonObj: MediaItem = {
                    id: pseudoId,
                    seasonName: 'Season ' + seasonNum,
                    seriesName: series.seriesName,
                    SeriesId: seriesId,
                    indexNumber: Number(seasonNum)
                };

                items.push(formatMediaItem(seasonObj, 'season', embyEmulation));
            }

            res.send({
                'Items': items,
                'TotalRecordCount': sortedSeasons.length,
                'StartIndex': startIndex
            });
        } else {
            res.send({
                Items: [],
                TotalRecordCount: 0,
                StartIndex: 0
            });
        }
    });

    const trackFor = (userId: number, type: string, id: number) => (type === 'movie'
        ? TrackMovie.findOne({ where: { userId, movieId: id } })
        : TrackEpisode.findOne({ where: { userId, episodeId: id } }));

    /** The UserItemDataDto for one movie or episode, from the user's own progress. */
    const userDataFor = async (userId: number | undefined, itemId: string): Promise<Record<string, unknown> | null> => {
        const { id, type } = parseId(itemId);

        if (!userId || !Number.isFinite(id) || !['movie', 'episode'].includes(type)) return null;

        const track = await trackFor(userId, type, id);
        const played = (track?.progress ?? 0) >= 1;

        return {
            PlaybackPositionTicks: played ? 0 : Math.round((track?.time ?? 0) * 10000000),
            PlayCount: played ? 1 : 0,
            IsFavorite: false,
            Played: played,
            LastPlayedDate: track?.updatedAt?.toISOString(),
            Key: itemId,
            ItemId: itemId
        };
    };

    /** Mark a movie, an episode, or every episode of a series, as watched or unwatched. */
    const markPlayed = (played: boolean) => async (req: EmbyRequest, res: Response): Promise<void> => {
        const itemId = String(req.params.itemid);
        const { id, type } = parseId(itemId);
        const userId = req.embyUserId;

        if (!userId || !Number.isFinite(id)) {
            res.status(404).send('Item not found');
            return;
        }

        if (type === 'series') {
            const episodes = await Episode.findAll({ where: { SeriesId: id }, attributes: ['id'] });

            for (const episode of episodes) await setPlayed(userId, 'episode', episode.id, played);
            res.send({
                Played: played,
                PlayCount: played ? 1 : 0,
                PlaybackPositionTicks: 0,
                IsFavorite: false,
                Key: itemId,
                ItemId: itemId
            });
            return;
        }

        if (type !== 'movie' && type !== 'episode') {
            res.status(404).send('Item not found');
            return;
        }

        await setPlayed(userId, type, id, played);
        res.send(await userDataFor(userId, itemId));
    };

    /** Started but unfinished movies and episodes, most recently watched first. */
    const resumeItems = async (req: EmbyRequest, res: Response): Promise<void> => {
        const userId = req.embyUserId;
        const limit = Math.min(Math.max(Number(getRequestValue(req, 'Limit')) || 12, 1), 100);
        const inProgress = {
            userId,
            progress: { [Op.gt]: 0, [Op.lt]: 0.9 }
        };
        const recent = {
            where: inProgress,
            order: [['updatedAt', 'DESC']] as [string, string][],
            limit
        };
        const [movieTracks, episodeTracks] = await Promise.all([TrackMovie.findAll(recent), TrackEpisode.findAll(recent)]);
        const files: Includeable = { model: File, include: [{ model: Stream }] };
        const ownProgress = (model: typeof TrackMovie | typeof TrackEpisode): Includeable => ({
            model,
            required: false,
            where: { userId }
        });
        const [movies, episodes] = await Promise.all([
            Movie.findAll({
                where: { id: movieTracks.map(track => track.movieId) },
                include: [files, ownProgress(TrackMovie)]
            }),
            Episode.findAll({
                where: { id: episodeTracks.map(track => track.episodeId) },
                include: [Series, files, ownProgress(TrackEpisode)]
            })
        ]);
        const watched = new Map<string, number>([
            ...movieTracks.map(track => [`movie:${track.movieId}`, track.updatedAt.getTime()] as [string, number]),
            ...episodeTracks.map(track => [`episode:${track.episodeId}`, track.updatedAt.getTime()] as [string, number])
        ]);
        const items = [
            ...movies.map(movie => ({ at: watched.get(`movie:${movie.id}`) ?? 0, item: formatMediaItem(movie as unknown as MediaItem, 'movie', embyEmulation) })),
            ...episodes.map(episode => ({ at: watched.get(`episode:${episode.id}`) ?? 0, item: formatMediaItem(episode as unknown as MediaItem, 'episode', embyEmulation) }))
        ].sort((a, b) => b.at - a.at).slice(0, limit).map(entry => entry.item);

        res.send({
            Items: items,
            TotalRecordCount: items.length,
            StartIndex: 0
        });
    };

    // Recently added items for a library view. Always answers: a parent Oblecto has no latest items
    // for (collections, a series, an unknown id) gets an empty list rather than a hung request.
    const getLatestItems = async (req: EmbyRequest, res: Response): Promise<void> => {
        const parentId = getRequestValue(req, 'ParentId');
        const limit = Math.min(Math.max(Number(getRequestValue(req, 'Limit')) || 16, 1), 100);
        const userId = req.embyUserId;
        const items: Record<string, unknown>[] = [];

        if (!parentId || parentId === 'movies') {
            const include: Includeable[] = [{ model: File, include: [{ model: Stream }] }];

            if (userId) {
                include.push({
                    model: TrackMovie,
                    required: false,
                    where: { userId }
                });
            }

            const movies = await Movie.findAll({
                include,
                order: [['createdAt', 'DESC']],
                limit
            });

            items.push(...movies.map(movie => formatMediaItem(movie as unknown as MediaItem, 'movie', embyEmulation)));
        }

        if (!parentId || parentId === 'shows') {
            const series = await Series.findAll({ order: [['createdAt', 'DESC']], limit });

            items.push(...series.map(show => formatMediaItem(show as unknown as MediaItem, 'series', embyEmulation)));
        }

        res.send(items.slice(0, limit));
    };

    server.get('/users/:userid/items/latest', getLatestItems);
    server.get('/items/latest', getLatestItems);

    server.get('/users/:userid/items/resume', (req: EmbyRequest, res: Response) => resumeItems(req, res));

    // Registered after /items/latest and /items/resume above, which it would otherwise swallow as an item id.
    server.get('/users/:userid/items/:mediaid', async (req: EmbyRequest, res: Response) => {
        const parsed = parseId(req.params.mediaid);
        const numericId = parsed.id;
        const userId = parseUuid(String(req.params.userid));
        let resolvedType = parsed.type;
        let item = null;

        const resolveMovie = async (movieId: number | string): Promise<Movie | null> => Movie.findByPk(movieId, {
            include: [
                {
                    model: File,
                    include: [{ model: Stream }]
                },
                {
                    model: TrackMovie,
                    required: false,
                    where: { userId: userId }
                }
            ]
        });

        const resolveEpisode = async (episodeId: number | string): Promise<Episode | null> => Episode.findByPk(episodeId, {
            include: [
                { model: Series },
                {
                    model: File,
                    include: [{ model: Stream }]
                },
                {
                    model: TrackEpisode,
                    required: false,
                    where: { userId: userId }
                }
            ]
        });

        const resolveSeries = async (seriesId: number | string): Promise<Series | null> => Series.findByPk(seriesId);

        if (resolvedType === 'movie' && Number.isFinite(numericId)) {
            item = await resolveMovie(numericId);
        } else if (resolvedType === 'series' && Number.isFinite(numericId)) {
            item = await resolveSeries(numericId);
        } else if (resolvedType === 'episode' && Number.isFinite(numericId)) {
            item = await resolveEpisode(numericId);
        } else if (resolvedType === 'season' && Number.isFinite(numericId)) {
            const seriesId = Math.floor(numericId / 1000);
            const seasonNum = numericId % 1000;
            const series = await Series.findByPk(seriesId);

            item = {
                id: numericId,
                seasonName: 'Season ' + seasonNum,
                seriesName: series ? series.seriesName : null,
                SeriesId: seriesId,
                indexNumber: seasonNum
            };
        }

        if (!item && Number.isFinite(numericId)) {
            item = await resolveMovie(numericId);
            if (item) {
                resolvedType = 'movie';
            } else {
                item = await resolveEpisode(numericId);
                if (item) {
                    resolvedType = 'episode';
                } else {
                    item = await resolveSeries(numericId);
                    if (item) {
                        resolvedType = 'series';
                    }
                }
            }
        }

        if (item) {
            // Special handling for Movie to include detailed media sources if needed,
            // but formatMediaItem handles basic properties.
            // The previous implementation for Movie manually constructed MediaSources.
            // formatMediaItem is simpler.
            // Let's rely on formatMediaItem to be consistent with /items/:mediaid
            // However, the previous implementation injected a LOT of extra fields for Movie.
            // If I replace it entirely with formatMediaItem, I might lose those fields (ExternalUrls, etc).
            // But consistency is better. The previous implementation had hardcoded "MediaSources" loop.
            // I should stick to formatMediaItem but maybe enhance it if needed.

            // Actually, for Movie, the previous code returned a very rich object.
            // For now, I will use formatMediaItem for ALL types to solve the "loading" issue for Series.
            // If Movie details regress, I can revisit.

            res.send(formatMediaItem(item, resolvedType, embyEmulation));
        } else {
            res.status(404).send('Item not found');
        }
    });

    server.get('/users/:userid/items/:mediaid/intros', (req, res) => {
        res.send({
            'Items': [],
            'TotalRecordCount': 0,
            'StartIndex': 0
        });
    });

    server.get('/useritems/resume', (req: EmbyRequest, res: Response) => resumeItems(req, res));

    // TODO: Implement Auth routes
    server.get('/auth/keys', (req, res) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.post('/auth/keys', (req, res) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.delete('/auth/keys/:key', (req, res) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.get('/auth/passwordresetproviders', (req, res) => {
        // TODO: Implement
        res.send([]); // Return empty list for now
    });

    server.get('/auth/providers', (req, res) => {
        // TODO: Implement
        res.send([]); // Return empty list for now
    });

    // Additional User Routes
    server.get('/users/:userid/policy', async (req: EmbyRequest, res: Response) => {
        const user = await User.findByPk(req.embyUserId);

        if (!user) return res.status(404).send('User not found');

        res.send(buildUserDto(user, embyEmulation, Boolean(user.password), await isAdministrator(user)).Policy);
    });
    server.post('/users/authenticatewithquickconnect', (req, res) => { res.status(501).send('Not Implemented'); });
    server.get('/users/configuration', (req, res) => { res.send([]); });
    server.post('/users/forgotpassword', (req, res) => { res.status(501).send('Not Implemented'); });
    server.post('/users/forgotpassword/pin', (req, res) => { res.status(501).send('Not Implemented'); });
    server.post('/users/new', (req, res) => { res.status(501).send('Not Implemented'); });
    // Changing the password signs this and every other session out, so the app asks to sign in again.
    const changePassword = async (req: EmbyRequest, res: Response) => {
        if (getRequestValue(req, 'ResetPassword') === 'true' || (req.body as { ResetPassword?: unknown })?.ResetPassword === true) {
            res.status(501).send('Removing a password is done with "oblecto removepassword"');
            return;
        }

        const user = await User.findByPk(req.embyUserId);

        if (!user) {
            res.status(404).send('User not found');
            return;
        }

        try {
            await changeOwnPassword(user, getRequestValue(req, 'CurrentPw'), getRequestValue(req, 'NewPw'), embyEmulation.oblecto.config.authentication.saltRounds);
            res.status(204).send();
        } catch (error) {
            if (!(error instanceof PasswordChangeError)) throw error;
            res.status(error.statusCode).send(error.message);
        }
    };

    server.post('/users/password', changePassword);
    server.post('/users/:userid/password', changePassword);

    // UserImage
    server.get('/userimage', (req, res) => { res.status(404).send('Not Found'); }); // This seems to be POST in some docs or GET specific image? Spec says GET /UserImage (truncated?)

    // UserItems
    server.get('/useritems/:itemid/userdata', async (req: EmbyRequest, res: Response) => {
        const data = await userDataFor(req.embyUserId, String(req.params.itemid));

        if (!data) return res.status(404).send('Item not found');
        res.send(data);
    });

    // Oblecto has no favourites or ratings yet; say so rather than pretend the change was kept.
    const unsupported = (feature: string) => (_req: Request, res: Response) => { res.status(501).send(`${feature} are not supported by Oblecto yet`); };

    server.post('/useritems/:itemid/rating', unsupported('Ratings'));
    server.delete('/useritems/:itemid/rating', unsupported('Ratings'));
    server.post('/users/:userid/items/:itemid/rating', unsupported('Ratings'));
    server.delete('/users/:userid/items/:itemid/rating', unsupported('Ratings'));

    // Played state, at the current path and the one older apps use
    for (const path of ['/userplayeditems/:itemid', '/users/:userid/playeditems/:itemid']) {
        server.post(path, markPlayed(true));
        server.delete(path, markPlayed(false));
    }

    for (const path of ['/userfavoriteitems/:itemid', '/users/:userid/favoriteitems/:itemid']) {
        server.post(path, unsupported('Favourites'));
        server.delete(path, unsupported('Favourites'));
    }

    // UserViews
    server.get('/userviews/groupingoptions', (req, res) => { res.send([]); });
};