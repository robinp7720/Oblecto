import fs from 'fs';

let config: IConfig;

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
        return { ...this.loadFile('/etc/oblecto/config.json') };
    },
    saveConfig: function saveConfig () {
        fs.writeFile('/etc/oblecto/config.json', JSON.stringify(config, null, 4), () => {

        });
    }
};

config = ConfigManager.loadConfigFiles();

export default config;

export { ConfigManager };

