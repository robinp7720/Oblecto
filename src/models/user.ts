import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
    declare id: CreationOptional<number>;
    declare username: string;
    declare name: string | null;
    declare email: string | null;
    declare password: string | null;
    declare access_token: string | null;
    // Shown on the local-network profile picker
    declare publicProfile: CreationOptional<boolean>;
    // May sign in without a password from the local network
    declare passwordlessLocal: CreationOptional<boolean>;
    // Avatar file name in assets.userAvatarLocation; changes with each upload
    declare avatar: string | null;
    // Grants permissions; null means none
    declare groupId: CreationOptional<number | null>;
    // Only the preferences the user changed; see lib/users/preferences
    declare preferences: CreationOptional<Record<string, unknown> | null>;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export const userColumns = {
    id: {
 type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true 
},
    username: { type: DataTypes.STRING(16), unique: true },
    name: DataTypes.STRING,
    email: DataTypes.STRING,
    password: DataTypes.STRING,
    access_token: { type: DataTypes.STRING, allowNull: true },
    publicProfile: {
        type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false
    },
    passwordlessLocal: {
        type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false
    },
    avatar: { type: DataTypes.STRING, allowNull: true },
    groupId: { type: DataTypes.INTEGER, allowNull: true },
    // Stored as text: MariaDB's JSON type reaches mysql2 as a plain string.
    preferences: {
        type: DataTypes.TEXT,
        allowNull: true,
        get(this: User): Record<string, unknown> | null {
            const raw = this.getDataValue('preferences') as unknown;

            if (typeof raw !== 'string' || raw === '') return null;

            try {
                const parsed = JSON.parse(raw) as unknown;

                return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
            } catch {
                return null;
            }
        },
        set(this: User, value: Record<string, unknown> | null) {
            this.setDataValue('preferences', (value === null ? null : JSON.stringify(value)) as unknown as Record<string, unknown> | null);
        }
    },

    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
};
