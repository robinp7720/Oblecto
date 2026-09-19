import logger from '../submodules/logger/index.js';

// Services get this long to close before the process exits anyway.
const SHUTDOWN_DEADLINE_MS = 15000;

/**
 * Process-wide handlers for a running server: close cleanly on SIGINT and SIGTERM, log promise
 * rejections nothing handled instead of letting Node end the process, and on an uncaught exception
 * log it and shut down with a failure code, so a supervisor such as systemd restarts Oblecto.
 * @param close - Closes every service; called at most once
 */
export function installLifecycle(close: () => Promise<void>): void {
    let closing = false;

    const shutdown = async (reason: string, exitCode: number): Promise<void> => {
        if (closing) return;
        closing = true;
        logger.info(`Shutting down (${reason})`);

        const deadline = setTimeout(() => process.exit(1), SHUTDOWN_DEADLINE_MS);

        deadline.unref();

        try {
            await close();
            process.exitCode = exitCode;
        } catch (error) {
            logger.error('Shutdown failed', error);
            process.exitCode = 1;
        } finally {
            clearTimeout(deadline);
            process.exit(process.exitCode ?? exitCode);
        }
    };

    process.on('SIGINT', () => { void shutdown('SIGINT', 0); });
    process.on('SIGTERM', () => { void shutdown('SIGTERM', 0); });

    process.on('unhandledRejection', (reason: unknown) => {
        logger.error('Unhandled promise rejection', reason);
    });

    process.on('uncaughtException', (error: Error) => {
        logger.error('Uncaught exception', error);
        void shutdown('uncaught exception', 1);
    });
}
