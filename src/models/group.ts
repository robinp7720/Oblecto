import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import type { Permission } from '../lib/auth/permissions.js';

export class Group extends Model<InferAttributes<Group>, InferCreationAttributes<Group>> {
    declare id: CreationOptional<number>;
    declare name: string;
    declare permissions: Permission[];
    // Built-in groups can't be renamed or deleted
    declare builtIn: CreationOptional<boolean>;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export const groupColumns = {
    id: {
        type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true
    },
    name: {
        type: DataTypes.STRING, allowNull: false, unique: true
    },
    // Stored as text: MariaDB's JSON type reaches mysql2 as a plain string.
    permissions: {
        type: DataTypes.TEXT,
        allowNull: false,
        get(this: Group): Permission[] {
            const raw = this.getDataValue('permissions') as unknown;

            if (Array.isArray(raw)) return raw as Permission[];
            if (typeof raw !== 'string' || raw === '') return [];

            try {
                const parsed = JSON.parse(raw) as unknown;

                return Array.isArray(parsed) ? parsed as Permission[] : [];
            } catch {
                return [];
            }
        },
        set(this: Group, value: Permission[]) {
            this.setDataValue('permissions', JSON.stringify(value) as unknown as Permission[]);
        }
    },
    builtIn: {
        type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false
    },

    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
};
