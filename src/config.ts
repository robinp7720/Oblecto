import fs from 'fs';
import { IConfig } from './interfaces/config.js';
import logger from './submodules/logger';

let loadedConfigPath: string | null = null;

const ConfigManager = {
    loadFile: function loadFile (file: string) {
        try {
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));

            loadedConfigPath = file;
            return data;
        } catch (ex: any) {
            if (ex.code === 'ENOENT') {
                console.log(`No config file at ${file}, continuing to next file`);

                return {};
            }
            logger.error(`There is an error with the config file located at ${file}:`, ex);
            return {};
        }
    },
    loadConfigFiles: function loadConfigs (): IConfig {
        if (process.env.OBLECTO_CONFIG_PATH) {
            return { ...this.loadFile(process.env.OBLECTO_CONFIG_PATH) };
        }
        if (fs.existsSync('./res/config.json')) {
            return { ...this.loadFile('./res/config.json') };
        }
        return { ...this.loadFile('/etc/oblecto/config.json') };
    },
    saveConfig: function saveConfig () {
        const savePath = loadedConfigPath || '/etc/oblecto/config.json';

        fs.writeFile(savePath, JSON.stringify(config, null, 4), (err) => {
            if (err) {
                logger.error(`Failed to save config to ${savePath}:`, err);
            } else {
                logger.info(`Config saved successfully to ${savePath}`);
            }
        });
    }
};

const config: IConfig = ConfigManager.loadConfigFiles();

export default config;

export { ConfigManager };

