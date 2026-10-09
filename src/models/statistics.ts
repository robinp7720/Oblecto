import { DataTypes, Model, type Optional, type Sequelize } from 'sequelize';

export interface ViewingAttributes {
    id: string;
    userId: number;
    itemType: string;
    itemId: number | null;
    fileId: number | null;
    title: string;
    client: string;
    duration: number;
    startedAt: Date;
    lastReportAt: Date;
    endedAt: Date | null;
    endReason: string | null;
    watchSeconds: number;
    completedAt: Date | null;
    firstPlayedAt: Date | null;
    quality: string;
    failure: string | null;
    bufferingReports: number | null;
    checkpoint: string;
}
export class ViewingSession extends Model<ViewingAttributes, Optional<ViewingAttributes,
    'endedAt' | 'endReason' | 'watchSeconds' | 'completedAt' | 'firstPlayedAt' | 'failure' | 'bufferingReports'>> { }

export interface DailyAttributes {
    id: string;
    sessionId: string;
    day: string;
    watchSeconds: number;
    estimatedSeconds: number;
    directSeconds: number;
    remuxSeconds: number;
    transcodeSeconds: number;
    unknownSeconds: number;
    plays: number;
    completions: number;
    repeatPlays: number;
}
export class ViewingDay extends Model<DailyAttributes> { }
export interface HealthAttributes { id: string; resolution: string; bucket: Date; data: string }
export class PlaybackHealth extends Model<HealthAttributes> { }
export class StatisticsMeta extends Model<{ id: string; value: string }> { }

const number = {
    type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0
};
const nullableDate = { type: DataTypes.DATE, allowNull: true };
const text = { type: DataTypes.STRING, allowNull: false };
export const viewingColumns = {
    id: { type: DataTypes.STRING(64), primaryKey: true },
    userId: {
        type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE'
    },
    itemType: { ...text },
    // Deliberately not foreign keys: deleted media must retain its historical snapshot.
    itemId: { type: DataTypes.INTEGER, allowNull: true },
    fileId: { type: DataTypes.INTEGER, allowNull: true },
    title: { ...text },
    client: { ...text },
    duration: { ...number },
    startedAt: { type: DataTypes.DATE, allowNull: false },
    lastReportAt: { type: DataTypes.DATE, allowNull: false },
    endedAt: { ...nullableDate },
    endReason: { type: DataTypes.STRING, allowNull: true },
    watchSeconds: { ...number },
    completedAt: { ...nullableDate },
    firstPlayedAt: { ...nullableDate },
    quality: { ...text },
    failure: { type: DataTypes.STRING, allowNull: true },
    bufferingReports: { type: DataTypes.INTEGER, allowNull: true },
    checkpoint: { type: DataTypes.TEXT('long'), allowNull: false }
};
export const viewingDayColumns = {
    id: { type: DataTypes.STRING(80), primaryKey: true },
    sessionId: {
        type: DataTypes.STRING(64), allowNull: false, references: { model: 'ViewingSessions', key: 'id' }, onDelete: 'CASCADE'
    },
    day: { type: DataTypes.STRING(10), allowNull: false },
    watchSeconds: { ...number },
    estimatedSeconds: { ...number },
    directSeconds: { ...number },
    remuxSeconds: { ...number },
    transcodeSeconds: { ...number },
    unknownSeconds: { ...number },
    plays: { ...number },
    completions: { ...number },
    repeatPlays: { ...number }
};
export const healthColumns = {
    id: { type: DataTypes.STRING(40), primaryKey: true },
    resolution: { ...text },
    bucket: { type: DataTypes.DATE, allowNull: false },
    data: { type: DataTypes.TEXT, allowNull: false }
};
export const statisticsMetaColumns = {
    id: { type: DataTypes.STRING(40), primaryKey: true },
    value: { type: DataTypes.TEXT, allowNull: false }
};
export function initStatisticsModels(sequelize: Sequelize): void {
    ViewingSession.init(viewingColumns, {
        sequelize, modelName: 'ViewingSession', timestamps: false
    });
    ViewingDay.init(viewingDayColumns, {
        sequelize, modelName: 'ViewingDay', timestamps: false
    });
    PlaybackHealth.init(healthColumns, {
        sequelize, modelName: 'PlaybackHealth', tableName: 'PlaybackHealth', timestamps: false
    });
    StatisticsMeta.init(statisticsMetaColumns, {
        sequelize, modelName: 'StatisticsMeta', tableName: 'StatisticsMeta', timestamps: false
    });
    ViewingDay.belongsTo(ViewingSession, {
        foreignKey: 'sessionId', as: 'session', onDelete: 'CASCADE'
    });
}
