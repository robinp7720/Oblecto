import { DataTypes, Model } from 'sequelize';

export class SeriesSet extends Model {}

export const seriesSetColumns = {
    setName: DataTypes.STRING,
    overview: DataTypes.TEXT,
    tmdbid: {
        type: DataTypes.INTEGER, allowNull: true, unique: true 
    },
    public: { type: DataTypes.BOOLEAN, defaultValue: true },
};
