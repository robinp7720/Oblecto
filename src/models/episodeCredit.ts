import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';

export class EpisodeCredit extends Model<InferAttributes<EpisodeCredit>, InferCreationAttributes<EpisodeCredit>> {
    declare id: CreationOptional<number>;
    declare episodeId: number;
    declare personId: number;
    declare creditType: 'cast' | 'crew';
    declare character: string | null;
    declare job: string | null;
    declare department: string | null;
    declare sortOrder: number | null;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export const episodeCreditColumns = {
    id: {
 type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true 
},
    episodeId: { type: DataTypes.INTEGER, allowNull: false },
    personId: { type: DataTypes.INTEGER, allowNull: false },
    creditType: { type: DataTypes.STRING, allowNull: false },
    character: { type: DataTypes.STRING, allowNull: true },
    job: { type: DataTypes.STRING, allowNull: true },
    department: { type: DataTypes.STRING, allowNull: true },
    sortOrder: { type: DataTypes.INTEGER, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
};
