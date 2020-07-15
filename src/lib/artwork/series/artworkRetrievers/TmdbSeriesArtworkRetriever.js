export default class TmdbSeriesArtworkRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async retrieveEpisodeBanner(episode) {
        let series = await episode.getTvshow();

        let data = await this.oblecto.tmdb.tvEpisodeImages({
            id: series.tmdbid,
            episode_number: episode.airedEpisodeNumber,
            season_number: episode.airedSeason
        });

        return  `https://image.tmdb.org/t/p/original${data.stills[0]['file_path']}`;
    }

    async retrieveSeriesPoster (series) {
        let data = await this.oblecto.tmdb.tvImages({
            id: series.tmdbid
        });

        return `https://image.tmdb.org/t/p/original${data.posters[0]['file_path']}`;
    }
}
