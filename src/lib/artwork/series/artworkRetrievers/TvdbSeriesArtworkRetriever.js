import tvdb from '../../../../submodules/tvdb';

export default class TvdbSeriesArtworkRetriever {
    async retrieveEpisodeBanner (episode) {
        if (!episode.tvdbid) throw new Error();

        let data = await tvdb.getEpisodeById(episode.tvdbid);

        return `https://thetvdb.com/banners/_cache/${data.filename}`;
    }

    async retrieveSeriesPoster (series) {
        if (!series.tvdbid) throw new Error();

        let data = await tvdb.getSeriesPosters(series.tvdbid);

        return `http://thetvdb.com/banners/${data[0].fileName}`;
    }
}
