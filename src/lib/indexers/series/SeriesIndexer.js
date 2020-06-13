import epinfer from 'epinfer';
import path from 'path';
import ffprobe from '../../../submodules/ffprobe';
import config from '../../../config';
import databases from '../../../submodules/database';
import UserManager from '../../../submodules/users';
import queue from '../../../submodules/queue';
import SeriesIdentifier from './SeriesIdentifer';


export default async function (episodePath, reIndex) {

    let result = epinfer.process(episodePath);
    let epinferEpisodeData = result.getData();

    let parsedPath = path.parse(episodePath);

    // First insert the file into the database so we know if the file was already indexed before
    // We can assume that if the file was already in the database it was already indexed by this indexer.
    // However, there is the option to not quit and continue indexing the file even if the file was already in the
    // database

    let [File, Created] = await databases.file.findOrCreate({
        where: {path: episodePath},
        defaults: {
            name: parsedPath.name,
            directory: parsedPath.dir,
            extension: epinferEpisodeData.extension,
            container: epinferEpisodeData.container
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

    let metadata = {};

    try {
        metadata = await ffprobe(episodePath);
    } catch (e) {
        console.log('Could not analyse ', episodePath, ' for duration. Maybe the file is corrupt?');

        if (!config.movies.indexBroken) {
            return false;
        }
    }

    let duration = metadata.format.duration;

    if (!(duration > 0) && !config.movies.indexBroken) {
        return false;
    }

    try {
        File.update({
            duration
        });
    } catch (e) {
        console.log('Error setting file duration', e);
    }


    let seriesIdentification;
    let episodeIdentification;

    console.log(`Starting identification for ${episodePath}`);

    try {
        seriesIdentification = await SeriesIdentifier.identifySeries(episodePath);

        if (!seriesIdentification) return false;

        console.log(`Series identified: ${seriesIdentification.seriesName}`);
        episodeIdentification = await SeriesIdentifier.identifyEpisode(episodePath, seriesIdentification);

        if (!episodeIdentification) return false;

        console.log(`Episode identified: ${episodeIdentification.episodeName}`);
    } catch (e) {
        console.log(e);

        return false;
    }

    if (!episodeIdentification) {
        console.log('File could not be matched:', episodePath);

        return false;
    }

    // Make sure the important attributes are included in the data
    if (!episodeIdentification.episodeName ||
        !episodeIdentification.airedEpisodeNumber ||
        !episodeIdentification.airedSeasonNumber) {

        console.log(episodeIdentification);
        console.log('Episode was matched but important information was missing:', episodePath);

        return false;
    }


    // TVDB has a few problems so we need to make sure to set default values for their values in case they
    // deliver garbage results

    /* TODO: Move site specific attributes to seperate database to prevent issues when a metadata collection site
    *   returns garbage results */

    let siteRating = null;
    let siteRatingCount = null;

    if (seriesIdentification.tvdb) {
        siteRating = seriesIdentification.tvdb.siteRating;
        siteRatingCount = seriesIdentification.tvdb.siteRatingCount;
    }

    // Insert the TVShow info into the database
    let [ShowEntry, showInserted] = await databases.tvshow
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

                siteRating: siteRating,
                siteRatingCount: siteRatingCount,

                directory: parsedPath.dir
            }
        });

    // Insert the episode into the database
    let [Episode, EpisodeInserted] = await databases.episode.findOrCreate({
        where: {
            tvshowId: ShowEntry.id,
            airedEpisodeNumber: episodeIdentification.airedEpisodeNumber,
            airedSeason: episodeIdentification.airedSeasonNumber,
        },
        defaults: {
            showid: seriesIdentification.tvdbId,
            tvdbid: episodeIdentification.tvdbId,

            episodeName: episodeIdentification.episodeName,

            absoluteNumber: episodeIdentification.absoluteNumber,
            dvdEpisodeNumber: episodeIdentification.dvdEpisodeNumber,
            dvdSeason: episodeIdentification.dvdSeasonNumber,

            firstAired: episodeIdentification.firstAired,
            overview: episodeIdentification.overview,
        }
    });

    if (EpisodeInserted) {
        // Inform all connected clients that a new episode has been imported
        queue.unshift({task: 'DownloadEpisodeBanner', id: Episode.id}, function () {
            UserManager.sendToAll('indexer', {event: 'added', type: 'episode'});
        });
    }

    // Link the file to the episode
    Episode.addFile(File);

    return true;
}
