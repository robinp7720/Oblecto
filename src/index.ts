import core from './core/index.js';

let closing = false;

const shutdown = (signal: string): void => {
    if (closing) return;
    closing = true;
    try {
        core.close();
    } finally {
        // Ensure the process exits even if cleanup hangs.
        setTimeout(() => process.exit(0), 250).unref();
        if (signal === 'SIGINT' || signal === 'SIGTERM') {
            process.exit(0);
        }
    }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

core.start();
