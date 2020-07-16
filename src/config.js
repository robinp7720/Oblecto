import os from 'os'
import fs from 'fs'

let config = {};

const ConfigManager = {
    loadFile: function loadFile (file) {
        try {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (ex) {
            if (ex.code === 'ENOENT') {
                console.log(`No config file at ${file}, continuing to next file`);

                return {};
            }
            console.log(`There is an error with the config file located at ${file}:`);
            console.log(ex.message);
            return {};
        }
    },
    loadConfigFiles: function loadConfigs () {
        config = {
            ...this.loadFile('/etc/oblecto/config.json')
        }
    },
    saveConfig: function saveConfig () {
        fs.writeFile('/etc/oblecto/config.json', JSON.stringify(config, null, 4), (stat, err) => {
            if (err) {
                console.log('An error has occurred while writing the config file: ', err)
            }
        });
    }
};

ConfigManager.loadConfigFiles();

export default config

export { ConfigManager }

