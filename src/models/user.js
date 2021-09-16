import { DataTypes, Model } from 'sequelize';

export class User extends Model {}

export const userColumns = {
    username:  { type: DataTypes.STRING(16), unique: true },
    name: DataTypes.STRING,
    email: DataTypes.STRING,
    password: DataTypes.STRING,
    access_token: { type: DataTypes.STRING, allowNull: true },
};
