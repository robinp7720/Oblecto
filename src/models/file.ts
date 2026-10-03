import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, HasManyGetAssociationsMixin, NonAttribute, HasManyCountAssociationsMixin, BelongsToManyCountAssociationsMixin } from 'sequelize';
import type { Stream } from './stream.js';
import type { Movie } from './movie.js';
import type { Episode } from './episode.js';

/**
 * Which step of indexing a problematic file failed at, which also decides how
 * it is retried: `identify` means no movie/episode could be matched (so the
 * file has nothing linked to it), `probe` means ffprobe could not read it.
 */
export type ProblemStage = 'identify' | 'probe';

/** A chapter of a file, in seconds. */
export type Chapter = { start: number; end: number; title: string | null };

export type SegmentType = 'intro' | 'credits' | 'recap' | 'preview';

/**
 * A stretch of a file a viewer may want to skip. `source` says how it was found: from chapter
 * titles, by matching audio across a season, or set by hand (which detection never replaces).
 */
export type Segment = { type: SegmentType; start: number; end: number; source: 'chapters' | 'fingerprint' | 'manual' };

/**
 * Thumbnails for seeking, `count` of them one every `interval` seconds, packed left to right and
 * top to bottom into `sheets` JPEG images of `tileWidth` by `tileHeight` thumbnails.
 */
export type Trickplay = {
    width: number;
    height: number;
    tileWidth: number;
    tileHeight: number;
    interval: number;
    count: number;
    sheets: number;
    // Bits per second a client needs to fetch the sheets while playing, as Jellyfin reports it
    bandwidth: number;
};

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

    declare problematic: CreationOptional<boolean>;
    declare problemStage: CreationOptional<ProblemStage | null>;
    declare problemIgnored: CreationOptional<boolean>;
    declare error: CreationOptional<string | null>;

    // Null until the file has been analysed; an empty list means there are none
    declare chapters: CreationOptional<Chapter[] | null>;
    declare segments: CreationOptional<Segment[] | null>;
    declare trickplay: CreationOptional<Trickplay | null>;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;

    // Mixins
    declare getStreams: HasManyGetAssociationsMixin<Stream>;
    declare countStreams: HasManyCountAssociationsMixin;
    declare Streams?: NonAttribute<Stream[]>;
    declare countMovies: BelongsToManyCountAssociationsMixin;
    declare countEpisodes: BelongsToManyCountAssociationsMixin;
    declare Movies?: NonAttribute<Movie[]>;
    declare Episodes?: NonAttribute<Episode[]>;
}

// Stored as JSON text, which SQLite and MariaDB both handle the same way
const jsonColumn = (name: 'chapters' | 'segments' | 'trickplay') => ({
    type: DataTypes.TEXT,
    allowNull: true,
    get(this: File): unknown {
        const raw = this.getDataValue(name) as unknown;

        if (typeof raw !== 'string') return raw ?? null;
        try {
            return JSON.parse(raw) as unknown;
        } catch {
            return null;
        }
    },
    set(this: File, value: unknown): void {
        this.setDataValue(name, (value === null || value === undefined ? null : JSON.stringify(value)) as never);
    }
});

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
    problemStage: { type: DataTypes.STRING, allowNull: true },
    problemIgnored: { type: DataTypes.BOOLEAN, defaultValue: false },
    error: { type: DataTypes.TEXT, allowNull: true },

    chapters: jsonColumn('chapters'),
    segments: jsonColumn('segments'),
    trickplay: jsonColumn('trickplay'),

    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
};
