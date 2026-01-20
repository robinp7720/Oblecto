import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey } from 'sequelize';

export class TrackMovie extends Model<InferAttributes<TrackMovie>, InferCreationAttributes<TrackMovie>> {
    declare id: CreationOptional<number>;
    declare userId: ForeignKey<number>;
    declare movieId: ForeignKey<number>;

    declare time: number | null;
    declare progress: number | null;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export const trackMovieColumns = {
    id: {
 type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true 
},
    userId: DataTypes.INTEGER,
    movieId: DataTypes.INTEGER,

    time: DataTypes.FLOAT,
    progress: DataTypes.FLOAT,

    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
};
