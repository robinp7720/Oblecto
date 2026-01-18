import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

export class Series extends Model<InferAttributes<Series>, InferCreationAttributes<Series>> {
    declare id: CreationOptional<number>;
    declare tvdbid: number | null;
    declare imdbid: string | null;
    declare zap2itId: string | null;
    declare tmdbid: number | null;

    declare seriesName: string | null;
    declare alias: string | null;
    declare genre: string | null;
    declare status: string | null;
    declare firstAired: string | null; // DATEONLY is string
    declare network: string | null;
    declare runtime: number | null;
    declare overview: string | null;
    declare airsDayOfWeek: string | null;
    declare airsTime: string | null;
    declare rating: string | null;
    declare popularity: number | null;

    declare siteRating: number | null;
    declare siteRatingCount: number | null;

    declare directory: string | null;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export const seriesColumns = {
    tvdbid: {
        type: DataTypes.INTEGER, allowNull: true, unique: true 
    },
    imdbid: {
        type: DataTypes.STRING(64), allowNull: true, unique: true 
    },
    zap2itId: {
        type: DataTypes.STRING(64), allowNull: true, unique: true 
    },
    tmdbid: {
        type: DataTypes.INTEGER, allowNull: true, unique: true 
    },

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
