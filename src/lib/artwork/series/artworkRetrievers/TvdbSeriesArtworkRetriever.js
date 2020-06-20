import tvdb from '../../../../submodules/tvdb';

export default class TvdbSeriesArtworkRetriever {
    async retrieveEpisodeBanner (episode) {
        let data = await tvdb.getEpisodeById(episode.tvdbid);

        return `https://thetvdb.com/banners/_cache/${data.filename}`;
    }

    async retrieveSeriesPoster (series) {
        let data = await tvdb.getSeriesPosters(series.tvdbid);

        return `http://thetvdb.com/banners/${data[0].fileName}`;
    }
}
