import { DataTypes, Model } from 'sequelize';

export class Movie extends Model {}

export const movieColumns = {
    tmdbid: { type: DataTypes.INTEGER, allowNull: true, unique: true },
    imdbid: { type: DataTypes.STRING, allowNull: true, unique: true },

    movieName: DataTypes.STRING,
    originalName: DataTypes.STRING,
    tagline: DataTypes.STRING,
    genres: DataTypes.STRING,

    originalLanguage: DataTypes.STRING,

    budget: DataTypes.INTEGER,
    revenue: DataTypes.INTEGER,

    runtime: DataTypes.INTEGER,

    popularity: DataTypes.FLOAT,

    releaseDate: DataTypes.DATEONLY,
    overview: DataTypes.TEXT,
};
