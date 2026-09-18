import { EventEmitter } from 'events';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import config, { configPath } from '../../config.js';

const LEVELS = ['error', 'warn', 'info', 'debug'] as const;

type LogLevel = typeof LEVELS[number];

const settings = config.logging ?? {};
const level: LogLevel = LEVELS.includes(settings.level as LogLevel) ? settings.level as LogLevel : 'info';

// Beside the config file (/etc/oblecto/logs by default), never wherever the process was started from.
const logDirectory = settings.directory || path.join(path.dirname(configPath()), 'logs');

/** Rotating file transports, or none when file logging is off or the directory cannot be created. */
function fileTransports(format: winston.Logform.Format): winston.transport[] {
    if (settings.file === false) return [];

    try {
        fs.mkdirSync(logDirectory, { recursive: true });
    } catch (error) {
        console.error(`Not writing log files: could not create ${logDirectory}: ${(error as Error).message}`);
        return [];
    }

    const rotation = {
        maxsize: Math.max(1, settings.maxSizeMB ?? 10) * 1024 * 1024,
        maxFiles: Math.max(1, settings.maxFiles ?? 5),
        tailable: true,
        format
    };

    return [
        new winston.transports.File({
            ...rotation,
            filename: path.join(logDirectory, 'error.log'),
            level: 'error'
        }),
        new winston.transports.File({
            ...rotation,
            filename: path.join(logDirectory, 'combined.log'),
            level
        })
    ];
}

class Logger extends EventEmitter {
    private _silent: boolean = false;
    private winston: winston.Logger;
    private consoleTransport: winston.transports.ConsoleTransportInstance;

    constructor() {
        super();

        // Custom format for console that mimics/improves the old one
        const consoleFormat = winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp }) => {
                return `${String(timestamp)} ${String(level)}: ${String(message)}`;
            })
        );

        // File format (JSON is good for parsing)
        const fileFormat = winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        );

        this.winston = winston.createLogger({
            level,
            transports: fileTransports(fileFormat)
        });

        this.consoleTransport = new winston.transports.Console({ format: consoleFormat, level });

        this.winston.add(this.consoleTransport);
    }

    get silent(): boolean {
        return this._silent;
    }

    set silent(value: boolean) {
        this._silent = value;
        if (value) {
            this.winston.remove(this.consoleTransport);
        } else {
            // Check if already added to avoid duplicates
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
            if (!this.winston.transports.includes(this.consoleTransport as any)) {
                this.winston.add(this.consoleTransport);
            }
        }
    }

    info(...messages: unknown[]): void {
        this.log('INFO', ...messages);
    }

    warn(...messages: unknown[]): void {
        this.log('WARN', ...messages);
    }

    error(...messages: unknown[]): void {
        this.log('ERROR', ...messages);
    }

    debug(...messages: unknown[]): void {
        this.log('DEBUG', ...messages);
    }

    log(level: string | Error, ...messages: unknown[]): void {

        // Handle case where level is an Error object (old API support)
        if (level instanceof Error) {
            const err = level;

            this.winston.error(err.message, { stack: err.stack });
            this.emit('log', { level: 'ERROR', messages: [err.message] });
            return;
        }

        // Extract potential stack traces for metadata
        const metadata: { stack?: string;[key: string]: unknown } = {};
        const messageParts = messages.map(msg => {
            if (msg instanceof Error) {
                if (!metadata.stack) {
                    metadata.stack = msg.stack;
                }
                return msg.message;
            }
            if (typeof msg === 'object' && msg !== null) {
                try {
                    return JSON.stringify(msg);
                } catch {
                    return '[Circular/Object]';
                }
            }
            return String(msg);
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
