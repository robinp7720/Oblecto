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

    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
};
