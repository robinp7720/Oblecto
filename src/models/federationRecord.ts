import { DataTypes, Model, InferAttributes, InferCreationAttributes } from 'sequelize';

/** Durable federation state; catalog staging is isolated from visible media tables. */
export class FederationRecord extends Model<InferAttributes<FederationRecord>, InferCreationAttributes<FederationRecord>> {
    declare scope: string;
    declare key: string;
    declare value: string;
    declare expires: number | null;
}
export const federationRecordColumns = {
    scope: { type: DataTypes.STRING, primaryKey: true },
    key: { type: DataTypes.STRING, primaryKey: true },
    value: { type: DataTypes.TEXT, allowNull: false },
    expires: { type: DataTypes.DOUBLE, allowNull: true }
};
