import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey } from 'sequelize';

/** What can be a favourite: the kinds of item a Jellyfin app shows a heart on. */
export const FAVOURITE_TYPES = ['movie', 'series', 'season', 'episode', 'person', 'boxset'] as const;

export type FavouriteType = typeof FAVOURITE_TYPES[number];

/** An item a user marked as a favourite. One row per user and item. */
export class UserFavourite extends Model<InferAttributes<UserFavourite>, InferCreationAttributes<UserFavourite>> {
    declare id: CreationOptional<number>;
    declare userId: ForeignKey<number>;
    declare itemType: FavouriteType;
    declare itemId: number;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export const userFavouriteColumns = {
    id: {
        type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true
    },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    itemType: { type: DataTypes.STRING(16), allowNull: false },
    itemId: { type: DataTypes.INTEGER, allowNull: false },

    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
};
