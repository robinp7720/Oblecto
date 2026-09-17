import core from './core/index.js';

let closing = false;

const shutdown = async (_signal: string): Promise<void> => {
    if (closing) return;
    closing = true;
    const deadline = setTimeout(() => process.exit(1), 15000);
    deadline.unref();
    try { await core.close(); process.exitCode = 0; }
    catch { process.exitCode = 1; }
    finally { clearTimeout(deadline); process.exit(process.exitCode ?? 0); }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

core.start();
