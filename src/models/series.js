import { DataTypes, Model } from 'sequelize';

export class Series extends Model {}

export const seriesColumns = {
    tvdbid: { type: DataTypes.INTEGER, allowNull: true, unique: true },
    imdbid: { type: DataTypes.STRING(64), allowNull: true, unique: true },
    zap2itId: { type: DataTypes.STRING(64), allowNull: true, unique: true },
    tmdbid: { type: DataTypes.INTEGER, allowNull: true, unique: true },

    seriesName: DataTypes.STRING,
    alias: DataTypes.STRING,
    genre: DataTypes.STRING,
    status: DataTypes.STRING,
    firstAired: DataTypes.DATEONLY,
    network: DataTypes.STRING,
    runtime: DataTypes.INTEGER,
    overview: DataTypes.TEXT,
    airsDayOfWeek: DataTypes.STRING,
    airsTime: DataTypes.STRING,
    rating: DataTypes.STRING,
    popularity: DataTypes.FLOAT,

    siteRating: DataTypes.DOUBLE,
    siteRatingCount: DataTypes.INTEGER,

    directory: DataTypes.STRING
};
