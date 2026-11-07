import type { MovieDb } from 'moviedb-promise';
import type { IConfig } from '../interfaces/config.js';
import type Queue from './queue/index.js';
import type { TvdbClient } from './common/tvdbTypes.js';
import type FileIndexer from './indexers/files/FileIndexer.js';
import type FileUpdateCollector from './updaters/files/FileUpdateCollector.js';
import type MediaAnalyser from './analysis/MediaAnalyser.js';
import type ArtworkUtils from './artwork/ArtworkUtils.js';
import type { PlaybackService } from './playback/PlaybackService.js';
import type { StatisticsService } from './statistics/StatisticsService.js';
import type RealtimeController from './realtime/RealtimeController.js';

/** Structural ports, so domain services and test doubles do not depend on the application container. */
export interface ServicePorts {
    queue: Pick<Queue, 'registerJob' | 'queueJob' | 'pushJob' | 'lowPriorityJob'> & Partial<Pick<Queue, 'maintenance'>>;
    tmdb: MovieDb;
    tvdb: TvdbClient;
    fileIndexer: Pick<FileIndexer, 'indexVideoFile'>;
    fileUpdateCollector: Pick<FileUpdateCollector, 'collectFile'>;
    artworkUtils: Omit<ArtworkUtils, 'oblecto'>;
    mediaAnalyser?: Pick<MediaAnalyser, 'queueFile' | 'removeFile' | 'trickplaySheet'>;
    realTimeController?: Pick<RealtimeController, 'broadcast'>;
    playback?: Pick<PlaybackService, 'analyseFile'>;
    statistics?: Pick<StatisticsService, 'begin' | 'failure' | 'end' | 'revise' | 'report'>;
}

export type Dependencies<Services extends keyof ServicePorts = never, Config extends keyof IConfig = never> =
    Pick<ServicePorts, Services> & ([Config] extends [never] ? object : { config: Pick<IConfig, Config> });
