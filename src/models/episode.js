import { DataTypes, Model } from 'sequelize';

export class Episode extends Model {}

export const episodeColumns = {
    tvdbid: {
        type: DataTypes.INTEGER, allowNull: true, unique: true
    },
    tmdbid: {
        type: DataTypes.INTEGER, allowNull: true, unique: true
    },
    imdbid: {
        type: DataTypes.STRING, allowNull: true, unique: true
    },

    episodeName: { type: DataTypes.STRING, allowNull: true },

    absoluteNumber: { type: DataTypes.INTEGER, allowNull: true },
    airedEpisodeNumber: { type: DataTypes.STRING, allowNull: false },
    airedSeason: { type: DataTypes.STRING, allowNull: false },
    dvdEpisodeNumber: { type: DataTypes.STRING, allowNull: true },
    dvdSeason: { type: DataTypes.STRING, allowNull: true },

    firstAired: { type: DataTypes.DATEONLY, allowNull: true },
    overview: { type: DataTypes.TEXT, allowNull: true },
};
