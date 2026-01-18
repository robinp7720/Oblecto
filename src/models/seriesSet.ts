import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute } from 'sequelize';
import { Series } from './series';

export class SeriesSet extends Model<InferAttributes<SeriesSet>, InferCreationAttributes<SeriesSet>> {
    declare id: CreationOptional<number>;
    declare setName: string | null;
    declare overview: string | null;
    declare tmdbid: number | null;
    declare public: CreationOptional<boolean>;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;

    // Associations
    declare Series?: NonAttribute<Series[]>;
    declare addSeries: (series: Series | number) => Promise<void>;
}

export const seriesSetColumns = {
    setName: DataTypes.STRING,
    overview: DataTypes.TEXT,
    tmdbid: {
        type: DataTypes.INTEGER, allowNull: true, unique: true 
    },
    public: { type: DataTypes.BOOLEAN, defaultValue: true },
};
