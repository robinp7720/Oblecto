import TvdbSeriesIdentifier from './identifiers/TvdbSeriesIdentifier';
import TmdbSeriesIdentifier from './identifiers/TmdbSeriesIdentifier';
import TvdbEpisodeIdentifier from './identifiers/TvdbEpisodeIdentifier';
import TmdbEpisodeIdentifier from './identifiers/TmdbEpisodeIdentifier';
import config from '../../../config';

export default {
    seriesIdentifiers: [
        new TvdbSeriesIdentifier(),
        new TmdbSeriesIdentifier()
    ],

    episodeIdentifiers: [
        new TvdbEpisodeIdentifier(),
        new TmdbEpisodeIdentifier()
    ],

    async identifySeries (episodePath) {
        let seriesIdentification = {};

        for (let i in this.seriesIdentifiers) {
            if (!this.seriesIdentifiers.hasOwnProperty(i))
                continue;

            let seriesIdentifier = this.seriesIdentifiers[i];

            let currentIdentification;

            try {
                currentIdentification = await seriesIdentifier.identify(episodePath);
            } catch (e) {
                continue;
            }

            Object.keys(currentIdentification).forEach((v, i) => {
                if (!seriesIdentification[v]) {
                    seriesIdentification[v] = currentIdentification[v];
                }
            });

            if (seriesIdentification.seriesName !== currentIdentification.seriesName && !config.tvshows.ignoreSeriesMismatch) {
                throw new Error('A name mismatch has occurred between series identifiers');
            }
        }

        if (seriesIdentification === {}) {
            throw new Error('Series could not be identified');
        }

        return seriesIdentification;
    },

    async identifyEpisode (episodePath, series) {
        let episodeIdentification = {};

        for (let i in this.episodeIdentifiers) {
            if (!this.episodeIdentifiers.hasOwnProperty(i))
                continue;

            let episodeIdentifier = this.episodeIdentifiers[i];

            let currentIdentification;

            try {
                currentIdentification = await episodeIdentifier.identify(episodePath, series);
            } catch (e) {
                console.log(`Identification using ${episodeIdentifier.constructor.name} has failed`);
                continue;
            }
            if (!currentIdentification) {
                continue;
            }

            Object.keys(currentIdentification).forEach((v, i) => {
                if (!episodeIdentification[v]) {
                    episodeIdentification[v] = currentIdentification[v];
                }
            });
        }

        if (this.episodeIdentifiers === {}) {
            throw new Error('Episode could not be identified');
        }

        return episodeIdentification;
    }

};
