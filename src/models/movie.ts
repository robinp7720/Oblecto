import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

export class Movie extends Model<InferAttributes<Movie>, InferCreationAttributes<Movie>> {
    declare id: CreationOptional<number>;
    
    declare tmdbid: number | null;
    declare imdbid: string | null;

    declare movieName: string | null;
    declare originalName: string | null;
    declare tagline: string | null;
    declare genres: string | null; // JSON string or comma separated? Usually string in Oblecto

    declare originalLanguage: string | null;

    declare budget: number | null;
    declare revenue: number | null;

    declare runtime: number | null;

    declare popularity: number | null;

    declare releaseDate: string | null; // DATEONLY is string in JS
    declare overview: string | null;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export const movieColumns = {
    tmdbid: {
        type: DataTypes.INTEGER, allowNull: true, unique: true 
    },
    imdbid: {
        type: DataTypes.STRING, allowNull: true, unique: true 
    },

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
