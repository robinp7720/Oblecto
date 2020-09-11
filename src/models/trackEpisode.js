import { DataTypes, Model } from 'sequelize';

export class TrackEpisode extends Model {}

export const trackEpisodesColumns = {
    time: DataTypes.FLOAT,
    progress: DataTypes.FLOAT
};
