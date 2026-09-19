import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';

export class Person extends Model<InferAttributes<Person>, InferCreationAttributes<Person>> {
    declare id: CreationOptional<number>;
    declare tmdbid: number;
    declare name: string;
    declare biography: string | null;
    declare birthday: string | null;
    declare deathday: string | null;
    declare placeOfBirth: string | null;
    declare knownForDepartment: string | null;
    declare profilePath: string | null;
    declare metadataUpdatedAt: Date | null;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export const personColumns = {
    id: {
 type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true 
},
    tmdbid: {
 type: DataTypes.INTEGER, allowNull: false, unique: true 
},
    name: { type: DataTypes.STRING, allowNull: false },
    biography: { type: DataTypes.TEXT, allowNull: true },
    birthday: { type: DataTypes.DATEONLY, allowNull: true },
    deathday: { type: DataTypes.DATEONLY, allowNull: true },
    placeOfBirth: { type: DataTypes.STRING, allowNull: true },
    knownForDepartment: { type: DataTypes.STRING, allowNull: true },
    profilePath: { type: DataTypes.STRING, allowNull: true },
    metadataUpdatedAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
};
