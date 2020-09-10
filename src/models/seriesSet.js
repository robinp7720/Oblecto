import { DataTypes, Model } from 'sequelize';

export class SeriesSet extends Model {}

export const seriesSetColumns = {
    setName: DataTypes.STRING,
    overview: DataTypes.TEXT,
};
