import epinfer from 'epinfer';
import config from "../../../config.json";
import async from "async";
import recursive from "recursive-readdir"
import path from "path"
import tvdb from "../../../submodules/tvdb";
import databases from "../../../submodules/database";

let ShowInfoCache = {};
let EpisodeCache  = {};

const scan = async function (EpisodePath) {
    let result = epinfer.process(EpisodePath);

    let EpisodeData = result.getData();
    let PathParsed = path.parse(EpisodePath);
    let ParentName = path.parse(PathParsed.dir);

    if (EpisodeData.filetype !== 'video' ||
        EpisodeData.subtype  !== 'episode') {
        return false;
    }

    // Insert the file into the database and skip if file was already indexed
    let [File, Created] = await databases.file.findOrCreate({
        where: {path: EpisodePath},
        defaults: {
            name: PathParsed.name,
            directory: PathParsed.dir,
            extension: PathParsed.ext
        }
    });

    if (Created) {
        console.log("File inserted:", EpisodePath);
    } else {
        console.log("File already in database:", EpisodePath);
        return false;
    }

    // Assume season 1 if season number is not present
    if (EpisodeData.season === undefined) {
        EpisodeData.season = 1
    }

    // Search for all shows with the title on TVDB
    let TvdbSearch = await tvdb.getSeriesByName(EpisodeData.series);


    let PossibleShows = [];

    // If the series year is defined in the title of the episode, search for all shows with that same year
    if (EpisodeData.series_year) {
        TvdbSearch.forEach(item => {
            if (item.firstAired.substr(0, 4) == EpisodeData.series_year)
                PossibleShows.push(item);
        })
    }

    // If no appropriate show could be found, try using the directory name instead
    if (PossibleShows.length < 1) {
        PossibleShows = await tvdb.getSeriesByName(ParentName);
    }

    // Select the first show of that list
    let SelectedShow = PossibleShows[0];

    // Get detailed info about the show
    let ShowInfo = {};
    if (ShowInfoCache[SelectedShow.id] === undefined) {
        ShowInfo = await tvdb.getSeriesById(SelectedShow.id);
        ShowInfoCache[SelectedShow.id] = ShowInfo;
    } else {
        ShowInfo = ShowInfoCache[SelectedShow.id]
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
        AllEpisodes = EpisodeCache[SelectedShow.id]
    }

    let SelectedEpisode = null;

    // Search for the correct episode
    AllEpisodes.forEach(episode => {
        if (episode.airedSeason        === EpisodeData.season &&
            episode.airedEpisodeNumber === EpisodeData.episode) {
            SelectedEpisode = episode;
        }
    });

    if (!SelectedEpisode)
        console.log(EpisodeData);

    // Insert the episode into the database
    let [Episode] = await databases.episode.findOrCreate({
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


    // Link the file to the episode
    Episode.addFile(File);

    return true;
};

export default {
    queue: async.queue((task, callback) => {
        scan(task.path).then(() => {
            callback(null)
        }).catch((err) => {
            console.log(err);
            callback(null);
        });
    }, config.tvshows.concurrency),


    async indexDirectory(Directory) {
        let files = await recursive(Directory);

        files.forEach(file => {
            this.queue.push({path: file}, function (err) {

            });
        })
    },

    async indexAll() {
        config.tvshows.directories.forEach(directory => {
            this.indexDirectory(directory.path)
        });

        return true;
    }
}