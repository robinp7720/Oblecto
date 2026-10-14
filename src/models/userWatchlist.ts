import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey } from 'sequelize';

/** Movies saved for later, independently of favourites and watched state. */
export class UserWatchlist extends Model<InferAttributes<UserWatchlist>, InferCreationAttributes<UserWatchlist>> {
    declare id: CreationOptional<number>;
    declare userId: ForeignKey<number>;
    declare movieId: ForeignKey<number>;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export const userWatchlistColumns = {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    movieId: { type: DataTypes.INTEGER, allowNull: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
};
