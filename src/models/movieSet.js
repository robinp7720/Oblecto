import { DataTypes, Model } from 'sequelize';

export class MovieSet extends Model {}

export const movieSetColumns = {
    setName: DataTypes.STRING,
    overview: DataTypes.TEXT,
    tmdbid: {
        type: DataTypes.INTEGER, allowNull: true, unique: true 
    },
    public: { type: DataTypes.BOOLEAN, defaultValue: true },
};
