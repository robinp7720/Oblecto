import { Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey } from 'sequelize';

export class EpisodeFiles extends Model<InferAttributes<EpisodeFiles>, InferCreationAttributes<EpisodeFiles>> {
    declare EpisodeId: ForeignKey<number>;
    declare FileId: ForeignKey<number>;
}

export const episodeFilesColumns = {};
