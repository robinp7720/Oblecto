import { EventEmitter } from 'events';
import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logDir = path.join(process.cwd(), 'logs');

if (!fs.existsSync(logDir)) {
    try {
        fs.mkdirSync(logDir);
    } catch (e) {
        console.error('Could not create logs directory', e);
    }
}

class Logger extends EventEmitter {
    constructor() {
        super();

        this._silent = false;

        // Custom format for console that mimics/improves the old one
        const consoleFormat = winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp }) => {
                return `${timestamp} ${level}: ${message}`;
            })
        );

        // File format (JSON is good for parsing)
        const fileFormat = winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        );

        this.winston = winston.createLogger({
            level: 'debug', // Capture everything, filtering happens in transports/logic
            format: fileFormat,
            transports: [
                new winston.transports.File({
                    filename: path.join(logDir, 'error.log'),
                    level: 'error'
                }),
                new winston.transports.File({ filename: path.join(logDir, 'combined.log') })
            ]
        });

        this.consoleTransport = new winston.transports.Console({ format: consoleFormat });

        this.winston.add(this.consoleTransport);
    }

    get silent() {
        return this._silent;
    }

    set silent(value) {
        this._silent = value;
        if (value) {
            this.winston.remove(this.consoleTransport);
        } else {
            // Check if already added to avoid duplicates
            if (!this.winston.transports.includes(this.consoleTransport)) {
                this.winston.add(this.consoleTransport);
            }
        }
    }

    info(...messages) {
        this.log('INFO', ...messages);
    }

    warn(...messages) {
        this.log('WARN', ...messages);
    }

    error(...messages) {
        this.log('ERROR', ...messages);
    }

    debug(...messages) {
        this.log('DEBUG', ...messages);
    }

    log(level, ...messages) {

        // Handle case where level is an Error object (old API support)

        if (level instanceof Error) {

            const err = level;

            this.winston.error(err.message, { stack: err.stack });

            this.emit('log', { level: 'ERROR', messages: [err.message] });

            return;

        }

        // Extract potential stack traces for metadata

        const metadata = {};

        const messageParts = messages.map(msg => {

            if (msg instanceof Error) {

                if (!metadata.stack) {

                    metadata.stack = msg.stack;

                }

                return msg.message;

            }

            if (typeof msg === 'object') {

                try {

                    return JSON.stringify(msg);

                } catch(e) {

                    return '[Circular/Object]';

                }

            }

            return msg;

        });

        const messageText = messageParts.join(' ');

        // Map string levels to winston levels

        // Default to info if unknown

        let winstonLevel = 'info';

        if (typeof level === 'string') {

            const lowerLevel = level.toLowerCase();

            if (['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'].includes(lowerLevel)) {

                winstonLevel = lowerLevel;

            }

        }

        // Log to winston

        this.winston.log({

            level: winstonLevel,

            message: messageText,

            ...metadata

        });

        // Emit event for TUI (maintaining old payload structure)

        this.emit('log', { level: level, messages: messageParts });

    }
}

export default new Logger();
