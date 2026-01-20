import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, BelongsToGetAssociationMixin } from 'sequelize';
import { Series } from './series.js';

export class Episode extends Model<InferAttributes<Episode>, InferCreationAttributes<Episode>> {
    declare id: CreationOptional<number>;

    declare getSeries: BelongsToGetAssociationMixin<Series>;

    declare tvdbid: number | null;
    declare tmdbid: number | null;
    declare imdbid: string | null;

    declare episodeName: string | null;

    declare absoluteNumber: number | null;
    declare airedEpisodeNumber: string;
    declare airedSeason: string;
    declare dvdEpisodeNumber: string | null;
    declare dvdSeason: string | null;

    declare firstAired: string | null;
    declare overview: string | null;

    declare SeriesId: CreationOptional<number>;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export const episodeColumns = {
    id: {
 type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true 
},
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

    SeriesId: DataTypes.INTEGER,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
};
