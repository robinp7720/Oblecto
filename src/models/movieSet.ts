import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute } from 'sequelize';
import { Movie } from './movie';

export class MovieSet extends Model<InferAttributes<MovieSet>, InferCreationAttributes<MovieSet>> {
    declare id: CreationOptional<number>;
    declare setName: string | null;
    declare overview: string | null;
    declare tmdbid: number | null;
    declare public: CreationOptional<boolean>;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;

    // Associations
    declare Movies?: NonAttribute<Movie[]>;
    declare addMovie: (movie: Movie | number) => Promise<void>;
}

export const movieSetColumns = {
    setName: DataTypes.STRING,
    overview: DataTypes.TEXT,
    tmdbid: {
        type: DataTypes.INTEGER, allowNull: true, unique: true 
    },
    public: { type: DataTypes.BOOLEAN, defaultValue: true },
};
