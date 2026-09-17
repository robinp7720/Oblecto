import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IConfig } from '../src/interfaces/config.js';

export async function startupConfig(): Promise<{ file: string; cleanup: () => Promise<void> }> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-startup-'));
    const config = JSON.parse(await fs.readFile(new URL('../res/config.json', import.meta.url), 'utf8')) as IConfig;
    config.database.storage = ':memory:';
    config.server.port = 0;
    config.federation.enable = false;
    config.indexer.runAtBoot = false;
    config.cleaner.runAtBoot = false;
    for (const seedbox of config.seedboxes) seedbox.enabled = false;
    config.tvshows.directories = [];
    config.movies.directories = [];
    config.streaming.cacheDirectory = path.join(root, 'cache');
    const file = path.join(root, 'config.json');
    await fs.writeFile(file, JSON.stringify(config));
    return { file, cleanup: () => fs.rm(root, { recursive: true, force: true }) };
}
