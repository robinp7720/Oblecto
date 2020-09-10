import { DataTypes, Model } from 'sequelize';

export class File extends Model {}

export const fileColumns = {
    host: DataTypes.STRING,
    path: DataTypes.STRING,

    name: DataTypes.STRING,
    directory: DataTypes.STRING,
    extension: DataTypes.STRING,
    container: DataTypes.STRING,

    videoCodec: DataTypes.STRING,
    audioCodec: DataTypes.STRING,

    duration: DataTypes.DOUBLE,

    hash: DataTypes.STRING
}
