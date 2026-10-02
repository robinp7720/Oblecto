import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey } from 'sequelize';

/**
 * What a Jellyfin app saved about how it shows things to a user (home sections, sort order, view,
 * skip lengths), kept as the app sent it. One row per user, preferences id and app.
 */
export class JellyfinDisplayPreferences extends Model<InferAttributes<JellyfinDisplayPreferences>, InferCreationAttributes<JellyfinDisplayPreferences>> {
    declare id: CreationOptional<number>;
    declare userId: ForeignKey<number>;
    declare preferencesId: string;
    declare client: string;
    declare data: string;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export const jellyfinDisplayPreferencesColumns = {
    id: {
        type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true
    },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    preferencesId: { type: DataTypes.STRING(128), allowNull: false },
    client: { type: DataTypes.STRING(64), allowNull: false },
    // The DisplayPreferencesDto as JSON. Text, as MariaDB's JSON type reaches mysql2 as a string anyway.
    data: { type: DataTypes.TEXT, allowNull: false },

    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
};
