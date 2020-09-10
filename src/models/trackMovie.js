import { DataTypes, Model } from 'sequelize';

export class TrackMovie extends Model {}

export const trackMovieColumns = {
    time: DataTypes.FLOAT,
    progress: DataTypes.FLOAT,
};
