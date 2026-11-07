import type { CreationAttributes } from 'sequelize';
import { File } from '../../src/models/file.js';

/** Some legacy route fixtures add hasMany file links instead of the production join tables. */
export function associatedFile(values: CreationAttributes<File> & { MovieId?: number; EpisodeId?: number }): Promise<File> {
    return File.create(values);
}
