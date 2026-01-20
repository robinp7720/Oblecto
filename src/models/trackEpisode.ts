import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey } from 'sequelize';

export class TrackEpisode extends Model<InferAttributes<TrackEpisode>, InferCreationAttributes<TrackEpisode>> {
    declare id: CreationOptional<number>;
    declare userId: ForeignKey<number>;
    declare episodeId: ForeignKey<number>;

    declare time: number | null;
    declare progress: number | null;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export const trackEpisodesColumns = {
    id: {
 type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true 
},
    userId: DataTypes.INTEGER,
    episodeId: DataTypes.INTEGER,

    time: DataTypes.FLOAT,
    progress: DataTypes.FLOAT,

    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
};
