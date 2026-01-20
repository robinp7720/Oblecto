import { DataTypes, Model, InferAttributes, InferCreationAttributes, ForeignKey } from 'sequelize';

export class MovieFiles extends Model<InferAttributes<MovieFiles>, InferCreationAttributes<MovieFiles>> {
    declare MovieId: ForeignKey<number>;
    declare FileId: ForeignKey<number>;
}

export const movieFileColumns = {
    MovieId: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Movies',
            key: 'id'
        },
        allowNull: false
    },
    FileId: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Files',
            key: 'id'
        },
        allowNull: false
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
};
