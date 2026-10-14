import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, BelongsToManyAddAssociationMixin, type ModelAttributeColumnOptions } from 'sequelize';
import type { File } from './file.js';

export type MovieTrailer = { name: string; site: 'YouTube' | 'Vimeo'; key: string; language: string | null; official: boolean };
export type MovieCertification = { country: string; certification: string };

export class Movie extends Model<InferAttributes<Movie>, InferCreationAttributes<Movie>> {
    declare id: CreationOptional<number>;

    declare addFile: BelongsToManyAddAssociationMixin<File, number>;

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
    declare siteRatingSource: string | null;
    declare siteRating: number | null;
    declare siteRatingCount: number | null;

    declare releaseDate: string | null; // DATEONLY is string in JS
    declare overview: string | null;

    declare trailers: CreationOptional<MovieTrailer[] | null>;
    declare certifications: CreationOptional<MovieCertification[] | null>;
    declare trailersUpdatedAt: CreationOptional<Date | null>;
    declare certificationsUpdatedAt: CreationOptional<Date | null>;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

const jsonColumn = (name: 'trailers' | 'certifications'): ModelAttributeColumnOptions<Movie> => ({
    type: DataTypes.TEXT,
    allowNull: true,
    get(this: Movie): unknown {
        const raw = this.getDataValue(name) as unknown;
        if (typeof raw !== 'string') return raw ?? null;
        try { return JSON.parse(raw) as unknown; } catch { return null; }
    },
    set(this: Movie, value: unknown): void {
        this.setDataValue(name, (value === null || value === undefined ? null : JSON.stringify(value)) as never);
    }
});

export const movieColumns = {
    id: {
 type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true 
},
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
    siteRatingSource: DataTypes.STRING,
    siteRating: DataTypes.DOUBLE,
    siteRatingCount: DataTypes.INTEGER,

    releaseDate: DataTypes.DATEONLY,
    overview: DataTypes.TEXT,

    trailers: jsonColumn('trailers'),
    certifications: jsonColumn('certifications'),
    trailersUpdatedAt: DataTypes.DATE,
    certificationsUpdatedAt: DataTypes.DATE,

    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
};
