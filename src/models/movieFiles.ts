import { Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey } from 'sequelize';

export class MovieFiles extends Model<InferAttributes<MovieFiles>, InferCreationAttributes<MovieFiles>> {
    declare MovieId: ForeignKey<number>;
    declare FileId: ForeignKey<number>;
}

export const movieFileColumns = {};
