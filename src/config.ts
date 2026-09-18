import fs from 'fs';
import { ConfigWriter } from './lib/settings/ConfigWriter.js';
import { IConfig } from './interfaces/config.js';
import defaults from '../res/config.json';

export const DEFAULT_CONFIG_PATH = '/etc/oblecto/config.json';

let loadedConfigPath: string | null = null;
let loadProblem: string | null = null;

const writer = new ConfigWriter(() => loadedConfigPath ?? configPath());

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

/** Fill in every key the file leaves out from the shipped template. Arrays and scalars in the file win. */
export function withDefaults<T>(base: T, override: unknown): T {
    if (!isPlainObject(base) || !isPlainObject(override)) return (override === undefined ? structuredClone(base) : override) as T;
    const merged: Record<string, unknown> = structuredClone(base);
    for (const [key, value] of Object.entries(override)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
        merged[key] = withDefaults(merged[key], value);
    }
    return merged as T;
}

/** The file Oblecto reads: OBLECTO_CONFIG_PATH when set, otherwise /etc/oblecto/config.json. */
export function configPath(): string {
    const fromEnvironment = process.env.OBLECTO_CONFIG_PATH;

    return fromEnvironment !== undefined && fromEnvironment !== '' ? fromEnvironment : DEFAULT_CONFIG_PATH;
}

const ConfigManager = {
    loadFile: function loadFile (file: string): Partial<IConfig> {
        try {
            const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<IConfig>;

            loadedConfigPath = file;
            return data;
        } catch (ex: unknown) {
            const error = ex as { code?: string; message?: string };

            loadProblem = error.code === 'ENOENT'
                ? `No config file at ${file}. Run "oblecto init" to create one, or set OBLECTO_CONFIG_PATH.`
                : `Could not read the config file at ${file}: ${error.message ?? String(ex)}`;
            return {};
        }
    },
    loadConfigFiles: function loadConfigs (): IConfig {
        return withDefaults(defaults as unknown as IConfig, this.loadFile(configPath()));
    },
    /** Why the config file could not be used, or null when it loaded. */
    loadProblem: (): string | null => loadProblem,
    saveConfig: function saveConfig (): Promise<void> {
        return writer.update(config, () => {});
    },
    updateConfig: function updateConfig(change: (draft: IConfig) => void, current: IConfig = config): Promise<void> {
        return writer.update(current, change);
    }
};

const config: IConfig = ConfigManager.loadConfigFiles();

export default config;
export { ConfigManager };
