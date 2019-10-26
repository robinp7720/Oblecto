import epinfer from 'epinfer';
import path from 'path';
import ffprobe from '../../../submodules/ffprobe';
import config from '../../../config';
import databases from '../../../submodules/database';
import UserManager from '../../../submodules/users';
import queue from '../../../submodules/queue';
import SeriesIdentifier from './SeriesIdentifer';

let seriesIdentifier = new SeriesIdentifier();

export default async function (episodePath, reIndex) {

    let result = epinfer.process(episodePath);
    let epinferEpisodeData = result.getData();

    let parsedPath = path.parse(episodePath);

    if (epinferEpisodeData.filetype !== 'video' ||
        epinferEpisodeData.subtype  !== 'episode') {
        console.log(episodePath, ' is not an episode');
        return false;
    }

    // First insert the file into the database so we know if the file was already indexed before
    // We can assume that if the file was already in the database it was already indexed by this indexer.
    // However, there is the option to not quit and continue indexing the file even if the file was already in the
    // database

    let metadata = {};
    let duration = 0;

    try {
        metadata = await ffprobe(episodePath);
        duration = metadata.format.duration;
    } catch (e) {
        console.log('Could not analyse ', episodePath, ' for duration. Maybe the file is corrupt?');

        if (!config.movies.indexBroken) {
            return false;
        }
    }

    let [File, Created] = await databases.file.findOrCreate({
        where: {path: episodePath},
        defaults: {
            name: parsedPath.name,
            directory: parsedPath.dir,
            extension: epinferEpisodeData.extension,
            container: epinferEpisodeData.container,

            duration: duration
        },
        //include: [databases.episode]
    });


    if (Created) {
        console.log('File inserted:', episodePath);
    } else {
        console.log('File already in database:', episodePath);

        // If reIndexing is disabled, quit now and don't attempt to classify file again
        // Quiting may result in problems if the file was inserted but there was an error with the classifier on
        // the first run.

        if (!reIndex) {
            return false;
        }
    }

    let seriesIdentification = await seriesIdentifier.identifySeries(episodePath);
    let episodeIdentification = await seriesIdentifier.identifyEpisode(episodePath, seriesIdentification);

    if (!episodeIdentification) {
        console.log('File could not be matched:', episodePath);

        return false;
    }

    // Insert the TVShow info into the database
    let [ShowEntry] = await databases.tvshow
        .findOrCreate({
            where: {
                tvdbid: seriesIdentification.tvdbId,
                tmdbid: seriesIdentification.tmdbId
            }, defaults: {
                seriesId: seriesIdentification.tvdbSeriesId,
                imdbid: seriesIdentification.imdbId,
                zap2itId: seriesIdentification.zap2itId,

                seriesName: seriesIdentification.seriesName,
                alias: JSON.stringify(seriesIdentification.alias),
                genre: JSON.stringify(seriesIdentification.genre),
                status: seriesIdentification.status,
                firstAired: seriesIdentification.firstAired,
                network: JSON.stringify(seriesIdentification.networks),
                runtime: seriesIdentification.runtime,
                overview: seriesIdentification.overview,
                airsDayOfWeek: seriesIdentification.airsDayOfWeek,
                airsTime: seriesIdentification.airsTime,
                rating: seriesIdentification.ageRating,
                popularity: seriesIdentification.tmdb.popularity,

                siteRating: seriesIdentification.tvdb.siteRating,
                siteRatingCount: seriesIdentification.tvdb.siteRatingCount,

                directory: parsedPath.dir
            }
        });

    // Insert the episode into the database
    let [Episode, EpisodeInserted] = await databases.episode.findOrCreate({
        where: {
            tvdbid: episodeIdentification.tvdbId
        },
        defaults: {
            showid: seriesIdentification.tvdbId,
            tvshowId: ShowEntry.id,

            episodeName: episodeIdentification.title,

            absoluteNumber: episodeIdentification.absoluteNumber,
            airedEpisodeNumber: episodeIdentification.airedEpisodeNumber,
            airedSeason: episodeIdentification.airedSeasonNumber,
            airedSeasonID: episodeIdentification.tvdb.airedSeasonId,
            dvdEpisodeNumber: episodeIdentification.dvdEpisodeNumber,
            dvdSeason: episodeIdentification.dvdSeasonNumber,

            firstAired: episodeIdentification.firstAired,
            overview: episodeIdentification.overview,
        }
    });

    if (EpisodeInserted) {
        // Inform all connected clients that a new episode has been imported
        UserManager.sendToAll('indexer', {event: 'added', type: 'episode'});
    }

    queue.push({task: 'DownloadEpisodeBanner', id: Episode.id}, function () {

    });

    // Link the file to the episode
    Episode.addFile(File);

    return true;
}
