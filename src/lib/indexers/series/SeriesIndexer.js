import epinfer from 'epinfer';
import Path from 'path';
import ffprobe from '../../../submodules/ffprobe';
import config from '../../../config';
import databases from '../../../submodules/database';
import UserManager from '../../../submodules/users';
import queue from '../../../submodules/queue';
import SeriesIdentifier from './SeriesIdentifer';
import FileIndexer from '../files/FileIndexer';
import FileExistsError from '../../errors/FileExistsError';
import VideoAnalysisError from '../../errors/VideoAnalysisError';


export default async function (episodePath, reIndex) {
    let file;

    try {
        file = await FileIndexer.indexVideoFile(episodePath);
    } catch (e) {
        if (e instanceof FileExistsError) {
            if (!reIndex) return false;
        } else if (e instanceof VideoAnalysisError) {
            console.log(`Error analysing ${episodePath}`);
            return false;
        } else {
            throw e;
        }
    }

    let parsedPath = Path.parse(episodePath);

    let seriesIdentification;
    let episodeIdentification;

    console.log(`Starting identification for ${episodePath}`);

    try {
        seriesIdentification = await SeriesIdentifier.identifySeries(episodePath);

        if (!seriesIdentification) return false;

        episodeIdentification = await SeriesIdentifier.identifyEpisode(episodePath, seriesIdentification);

        if (!episodeIdentification) return false;
    } catch (e) {
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
    let [showEntry, showInserted] = await databases.tvshow
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
    let [episode, episodeInserted] = await databases.episode.findOrCreate({
        where: {
            tvshowId: showEntry.id,
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

    if (episodeInserted) {
        // Inform all connected clients that a new episode has been imported
        queue.unshift({task: 'DownloadEpisodeBanner', id: episode.id}, function () {
            UserManager.sendToAll('indexer', {event: 'added', type: 'episode'});
        });
    }

    // Link the file to the episode
    episode.addFile(file);

    return true;
}
