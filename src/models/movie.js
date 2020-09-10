import { DataTypes, Model } from 'sequelize';

export class Movie extends Model {}

export const movieColumns = {
    tmdbid: { type: DataTypes.INTEGER, allowNull: true, unique: true },

    movieName: DataTypes.STRING,

    popularity: DataTypes.FLOAT,

    releaseDate: DataTypes.DATEONLY,
    overview: DataTypes.TEXT,
};
