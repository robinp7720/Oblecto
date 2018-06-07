import epinfer from 'epinfer';
import path from 'path';
import tvdb from '../../../submodules/tvdb';
import databases from '../../../submodules/database';
import queue from '../../../submodules/queue';
import UserManager from '../../../submodules/users';

let ShowInfoCache = {};
let EpisodeCache  = {};

export default async function (EpisodePath, reIndex) {
    let result = epinfer.process(EpisodePath);

    let EpisodeData = result.getData();

    let PathParsed = path.parse(EpisodePath);
    let ParentName = path.parse(PathParsed.dir).name;

    if (EpisodeData.filetype !== 'video' ||
        EpisodeData.subtype  !== 'episode') {
        console.log(EpisodePath, ' is not an episode');
        return false;
    }

    // First insert the file into the database so we know if the file was already indexed before
    // We can assume that if the file was already in the database it was already indexed by this indexer.
    // However, there is the option to not quit and continue indexing the file even if the file was already in the
    // database

    let [File, Created] = await databases.file.findOrCreate({
        where: {path: EpisodePath},
        defaults: {
            name: PathParsed.name,
            directory: PathParsed.dir,
            extension: PathParsed.ext
        },
        //include: [databases.episode]
    });

    if (Created) {
        console.log('File inserted:', EpisodePath);
    } else {
        console.log('File already in database:', EpisodePath);

        // If reIndexing is disabled, quit now and don't attempt to classify file again
        // Quiting may result in problems if the file was inserted but there was an error with the classifier on
        // the first run.

        if (!reIndex) {
            return false;
        }
    }

    // Assume season 1 if season number is not present
    if (EpisodeData.season === undefined) {
        EpisodeData.season = 1;
    }

    // Search for all shows with the title on TVDB
    let TvdbSearch = [];

    if (EpisodeData.series) {
        try {
            TvdbSearch = await tvdb.getSeriesByName(EpisodeData.series);
        } catch (e) {
            // Use the directory name if an error occured when using the name of the file
            TvdbSearch = await tvdb.getSeriesByName(ParentName);
        }
    } else {
        // If the Series name could not be found in the filename, use the directory name
        TvdbSearch = await tvdb.getSeriesByName(ParentName);
    }


    let PossibleShows = [];

    // If the series year is defined in the title of the episode, search for all shows with that same year
    if (EpisodeData.series_year) {
        TvdbSearch.forEach(item => {
            if (item.firstAired.substr(0, 4) === EpisodeData.series_year)
                PossibleShows.push(item);
        });
    } else {
        PossibleShows = TvdbSearch;
    }

    // If no appropriate show could be found and the series name was available in the file name, try using the directory name instead
    if (PossibleShows.length < 1 && EpisodeData.series) {
        PossibleShows = await tvdb.getSeriesByName(ParentName);
    }

    // Select thme first show of that list
    let SelectedShow = PossibleShows[0];

    // Get detailed info about the show
    let ShowInfo = {};
    if (ShowInfoCache[SelectedShow.id] === undefined) {
        ShowInfo = await tvdb.getSeriesById(SelectedShow.id);
        ShowInfoCache[SelectedShow.id] = ShowInfo;
    } else {
        ShowInfo = ShowInfoCache[SelectedShow.id];
    }

    // Insert the TVShow info into the database
    let [ShowEntry] = await databases.tvshow
        .findOrCreate({
            where: {tvdbid: ShowInfo.id}, defaults: {
                seriesId: ShowInfo.seriesId,
                imdbid: ShowInfo.imdbId,
                zap2itId: ShowInfo.zap2itId,

                seriesName: ShowInfo.seriesName,
                alias: JSON.stringify(ShowInfo.aliases),
                genre: JSON.stringify(ShowInfo.genre),
                status: ShowInfo.status,
                firstAired: ShowInfo.firstAired,
                network: ShowInfo.network,
                runtime: ShowInfo.runtime,
                overview: ShowInfo.overview,
                airsDayOfWeek: ShowInfo.airsDayOfWeek,
                airsTime: ShowInfo.airsTime,
                rating: ShowInfo.rating,

                siteRating: ShowInfo.siteRating,
                siteRatingCount: ShowInfo.siteRatingCount,

                directory: PathParsed.dir
            }
        });

    let AllEpisodes = {};
    if (EpisodeCache[SelectedShow.id] === undefined) {
        AllEpisodes = await tvdb.getEpisodesBySeriesId(ShowInfo.id);
        EpisodeCache[SelectedShow.id] = AllEpisodes;
    } else {
        AllEpisodes = EpisodeCache[SelectedShow.id];
    }

    let SelectedEpisode = null;

    // Search for the correct episode
    AllEpisodes.forEach(episode => {
        if (episode.airedSeason        === EpisodeData.season &&
            episode.airedEpisodeNumber === EpisodeData.episode) {
            SelectedEpisode = episode;
        }
    });

    if (!SelectedEpisode) {
        console.log('File count not be matched:', EpisodePath);

        return false;
    }

    // Insert the episode into the database
    let [Episode, EpisodeInserted] = await databases.episode.findOrCreate({
        where: {tvdbid: SelectedEpisode.id},
        defaults: {
            showid: ShowInfo.id,
            tvshowId: ShowEntry.id,

            episodeName: SelectedEpisode.episodeName,

            absoluteNumber: SelectedEpisode.absoluteNumber,
            airedEpisodeNumber: SelectedEpisode.airedEpisodeNumber,
            airedSeason: SelectedEpisode.airedSeason,
            airedSeasonID: SelectedEpisode.airedSeasonID,
            dvdEpisodeNumber: SelectedEpisode.dvdEpisodeNumber,
            dvdSeason: SelectedEpisode.dvdSeason,

            firstAired: SelectedEpisode.firstAired,
            overview: SelectedEpisode.overview,
        }
    });

    if (EpisodeInserted) {
        // Inform all connected clients that a new episode has been imported
        UserManager.sendToAll('indexer', {event: 'added', type: 'episode'});
    } else {

    }

    queue.push({task: 'DownloadEpisodeBanner', id: Episode.id}, function (err) {

    });

    // Link the file to the episode
    Episode.addFile(File);

    return true;
}