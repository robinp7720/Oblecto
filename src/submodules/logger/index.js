import {EventEmitter} from 'events';

class Logger extends EventEmitter{
    constructor() {
        super();

        this.silent = false;

        this.on('log', (log) => {
            if (!this.silent) {
                console.log(log.level, ...log.messages);
            }
        });
    }

    log(level, ...messages) {
        this.emit('log', {
            level, messages
        });
    }
}

export default new Logger();
