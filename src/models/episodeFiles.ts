import { DataTypes, Model, InferAttributes, InferCreationAttributes, ForeignKey } from 'sequelize';

export class EpisodeFiles extends Model<InferAttributes<EpisodeFiles>, InferCreationAttributes<EpisodeFiles>> {
    declare EpisodeId: ForeignKey<number>;
    declare FileId: ForeignKey<number>;
}

export const episodeFilesColumns = {
    EpisodeId: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Episodes',
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
