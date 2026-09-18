import fs from 'fs';
import { ConfigWriter } from './lib/settings/ConfigWriter.js';
import { IConfig } from './interfaces/config.js';
import logger from './submodules/logger';

let loadedConfigPath: string | null = null;

const writer = new ConfigWriter(() => loadedConfigPath ?? '/etc/oblecto/config.json');

const ConfigManager = {
    loadFile: function loadFile (file: string): Partial<IConfig> {
        try {
            const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<IConfig>;

            loadedConfigPath = file;
            return data;
        } catch (ex: unknown) {
            const error = ex as { code?: string };
            if (error.code === 'ENOENT') {
                console.log(`No config file at ${file}, continuing to next file`);

                return {};
            }
            logger.error(`There is an error with the config file located at ${file}:`, ex);
            return {};
        }
    },
    loadConfigFiles: function loadConfigs (): IConfig {
        if (process.env.OBLECTO_CONFIG_PATH !== undefined && process.env.OBLECTO_CONFIG_PATH !== '') {
            return { ...this.loadFile(process.env.OBLECTO_CONFIG_PATH) } as IConfig;
        }
        if (fs.existsSync('./res/config.json')) {
            return { ...this.loadFile('./res/config.json') } as IConfig;
        }
        return { ...this.loadFile('/etc/oblecto/config.json') } as IConfig;
    },
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
