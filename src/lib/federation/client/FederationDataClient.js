import FederationClient from './FederationClient';
import databases from '../../../submodules/database';
import tvdb from '../../../submodules/tvdb';
import async from 'async';

export default class FederationDataClient extends FederationClient {
    constructor(host, port) {
        super(host, port || 9131);

        this.indexQueue = async.queue(async (file, callback) => {
            let [fileEntity, fileInserted] = await databases.file.findOrCreate({
                where: {
                    host: this.host,
                    path: file.id
                },
                defaults: {
                    name: '',
                    directory: '',
                    extension: '',
                    duration: file.duration
                }
            });

            if (file.fileInfo.type === 'episode') {
                try {
                    let episode = await this.episodeHandler(file.fileInfo, this);
                    episode.addFile(fileEntity);
                } catch (e) {
                    console.log(e);
                }
            }

            callback();
        });
    }

    headerHandler(data, _this) {
        super.headerHandler(data, _this);

        let split = data.split(':');

        switch (split[0]) {
        case 'FILE':
            _this.fileHandler(split[1], _this);
            break;
        }
    }

    requestFullSync() {
        this.write('SYNC', 'FULL');
    }

    async fileHandler(data, _this) {
        let input = Buffer.from(data, 'base64').toString();
        let file = JSON.parse(input);

        _this.indexQueue.push(file);

    }

    async episodeHandler(data, _this) {
        let [episode, episodeInserted] = await databases.episode.findOrCreate({
            where: {
                tvdbid: data.tvdbid,
                tmdbid: data.tmdbid
            }
        });

        if (!episodeInserted) return episode;

        let episodeData = await tvdb.getEpisodeById(data.tvdbid);


        let series = await _this.seriesHandler(episodeData.seriesId, _this);

        await episode.update({
            airedEpisodeNumber: episodeData.airedEpisodeNumber,
            airedSeason: episodeData.airedSeason,

            episodeName: episodeData.episodeName,

            absoluteNumber: episodeData.absoluteNumber,
            dvdEpisodeNumber: episodeData.dvdEpisodeNumber,
            dvdSeason: episodeData.dvdSeason,

            firstAired: episodeData.firstAired,
            overview: episodeData.overview

        });

        series.addEpisode(episode);

        return episode;
    }

    async seriesHandler(tvdbid, _this) {
        let showInfo = await tvdb.getSeriesById(tvdbid);

        if (showInfo.seriesId === '') showInfo.seriesId = null;

        let [showEntry, showInserted] = await databases.tvshow
            .findOrCreate({
                where: {
                    tvdbid: showInfo.id,
                }, defaults: {
                    seriesId: showInfo.seriesId,
                    imdbid: showInfo.imdbId,
                    zap2itId: showInfo.zap2itId,

                    seriesName: showInfo.seriesName,
                    alias: JSON.stringify(showInfo.alias),
                    genre: JSON.stringify(showInfo.genre),
                    status: showInfo.status,
                    firstAired: showInfo.firstAired,
                    network: JSON.stringify(showInfo.networks),
                    runtime: showInfo.runtime,
                    overview: showInfo.overview,
                    airsDayOfWeek: showInfo.airsDayOfWeek,
                    airsTime: showInfo.airsTime,
                    rating: showInfo.rating,

                    siteRating: showInfo.siteRating,
                    siteRatingCount: showInfo.siteRatingCount,
                }
            });

        return showEntry;
    }
}
