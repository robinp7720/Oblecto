import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, HasManyGetAssociationsMixin, NonAttribute, HasManyCountAssociationsMixin } from 'sequelize';
import type { Stream } from './stream.js';

export class File extends Model<InferAttributes<File>, InferCreationAttributes<File>> {
    declare id: CreationOptional<number>;

    declare host: string | null;
    declare path: string | null;

    declare name: string | null;
    declare directory: string | null;
    declare extension: string | null;
    declare container: string | null;

    declare videoCodec: string | null;
    declare audioCodec: string | null;

    declare duration: number | null; // DOUBLE

    declare hash: string | null;
    declare size: number | null; // BIGINT is usually returned as string in JS, but Sequelize might handle number if safe. Type as number | string to be safe or number if configured. Defaulting to number | null for now.

    declare problematic: boolean;
    declare error: string | null;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;

    // Mixins
    declare getStreams: HasManyGetAssociationsMixin<Stream>;
    declare countStreams: HasManyCountAssociationsMixin;
    declare Streams?: NonAttribute<Stream[]>;
}

export const fileColumns = {
    id: {
        type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true
    },
    host: DataTypes.STRING,
    path: DataTypes.STRING,

    name: DataTypes.STRING,
    directory: DataTypes.STRING,
    extension: DataTypes.STRING,
    container: DataTypes.STRING,

    videoCodec: DataTypes.STRING,
    audioCodec: DataTypes.STRING,

    duration: DataTypes.DOUBLE,

    hash: { type: DataTypes.STRING, allowNull: true },
    size: { type: DataTypes.BIGINT, allowNull: true },

    problematic: { type: DataTypes.BOOLEAN, defaultValue: false },
    error: { type: DataTypes.TEXT, allowNull: true },

    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
};
