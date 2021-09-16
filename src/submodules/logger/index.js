import { EventEmitter } from 'events';
import ExtendableError from '../../lib/errors/ExtendableError';

class Logger extends EventEmitter{
    constructor() {
        super();

        this.silent = false;

        this.on('log', (log) => {
            if(this.silent) return;
            if (log.level === 'DEBUG') return;

            if (log instanceof ExtendableError) {
                console.log(log.level, log);
                return;
            }

            if (log instanceof Error) {
                console.log('ERROR', log);
                return;
            }

            console.log(log.level, ...log.messages);
        });
    }

    log(level, ...messages) {
        // If an error was passed right into the log function
        if (level instanceof Error) {
            this.emit('log', level);

            return;
        }

        this.emit('log', { level, messages });
    }
}

export default new Logger();
