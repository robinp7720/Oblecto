import TvdbSeriesIdentifier from './identifiers/TvdbSeriesIdentifier';
import TmdbSeriesIdentifier from './identifiers/TmdbSeriesIdentifier';
import TvdbEpisodeIdentifier from './identifiers/TvdbEpisodeIdentifier';
import TmdbEpisodeIdentifier from './identifiers/TmdbEpisodeIdentifier';

export default class SeriesIdentifier {
    constructor() {
        this.seriesIdentifiers = [
            new TvdbSeriesIdentifier(),
            new TmdbSeriesIdentifier()
        ];

        this.episodeIdentifiers = [
            new TvdbEpisodeIdentifier(),
            new TmdbEpisodeIdentifier()
        ];
    }

    async identifySeries (episodePath) {
        let seriesIdentification = {};

        for (let i in this.seriesIdentifiers) {
            if (!this.seriesIdentifiers.hasOwnProperty(i))
                continue;

            let seriesIdentifier = this.seriesIdentifiers[i];

            let currentIdentification = await seriesIdentifier.identify(episodePath);

            Object.keys(currentIdentification).forEach((v, i) => {
                if (!seriesIdentification[v]) {
                    seriesIdentification[v] = currentIdentification[v];
                }
            });
        }

        return seriesIdentification;
    }

    async identifyEpisode (episodePath, series) {
        let episodeIdentification = {};

        for (let i in this.episodeIdentifiers) {
            if (!this.episodeIdentifiers.hasOwnProperty(i))
                continue;

            let episodeIdentifier = this.episodeIdentifiers[i];

            let currentIdentification = await episodeIdentifier.identify(episodePath, series);

            if (!currentIdentification) {
                continue;
            }

            Object.keys(currentIdentification).forEach((v, i) => {
                if (!episodeIdentification[v]) {
                    episodeIdentification[v] = currentIdentification[v];
                }
            });
        }

        return episodeIdentification;
    }

}
