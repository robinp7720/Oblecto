import {promises as fs} from 'fs';

export default class cliManager {

    constructor(){
        this.commands = {};
        this.commandCategories = {};
    }

    registerCommand(command){
        let currentPath = this.commands;
        
        for (let part of command.args){
            if (part.includes('[')){
                break;
            }
            if (!currentPath[part]){
                currentPath[part] = {};
            }
            currentPath = currentPath[part];
        }
        if (command.category) {
            if (!this.commandCategories[command.category]) {
                this.commandCategories[command.category] = [];
            }

            this.commandCategories[command.category].push(command);
        }

        currentPath['_default'] = command;
    }

    execute(args){
        let currentCommandPath = this.commands;

        for (let part of args){
            if (currentCommandPath[part]){
                currentCommandPath = currentCommandPath[part];
            } else {
                // This is where it gets spicy
                if (currentCommandPath['_default']){
                    if (currentCommandPath['_default'].args.length == args.length){
                        break;
                    } else {
                        console.log(`The ${args[0]} command was expecting ${currentCommandPath['_default'].args.length - 1} arguments like so: oblecto ${currentCommandPath['_default'].args.join(" ")}`);
                        return;
                    }
                }
            }
        }

        if (currentCommandPath['_default']){
            currentCommandPath = currentCommandPath['_default'];

            switch (currentCommandPath.runType){
                case 'start':
                    require(currentCommandPath.executePath).default.start();
                    break;
                case 'default':
                    require(currentCommandPath.executePath).default(args);
                    break;
                case 'help':
                    this.help();
                    break;
            }
        } else {
            this.help();
        }

    }

    async help(){
        let packageInfo = JSON.parse(await fs.readFile(__dirname + '/../../package.json'));

        console.log(`Oblecto ${packageInfo.version}`);
        console.log();

        for (const [categoryName, commands] of Object.entries(this.commandCategories)){
            console.log(`${categoryName}:`);

            for (let command of commands){
                console.log(`"oblecto ${command.args.join(" ")}" - ${command.description}`);
            }

            console.log();
        }

    }
}