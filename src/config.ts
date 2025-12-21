import fs from 'fs';
import { IConfig } from './interfaces/config.js';

const ConfigManager = {
    loadFile: function loadFile (file: string) {
        try {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (ex: any) {
            if (ex.code === 'ENOENT') {
                console.log(`No config file at ${file}, continuing to next file`);

                return {};
            }
            console.log(`There is an error with the config file located at ${file}:`);
            console.log(ex.message);
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
        fs.writeFile('/etc/oblecto/config.json', JSON.stringify(config, null, 4), () => {

        });
    }
};

const config: IConfig = ConfigManager.loadConfigFiles();

export default config;

export { ConfigManager };

