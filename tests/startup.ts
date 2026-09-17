import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { startupConfig } from './startupConfig.js';

const config = await startupConfig();
try {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, ['dist/index.js'], {
                env: { ...process.env, OBLECTO_CONFIG_PATH: config.file },
                stdio: ['ignore', 'pipe', 'pipe']
            });
            let output = '';
            let signalled = false;
            let timedOut = false;
            const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 25000);
            const capture = (data: Buffer) => {
                output += data.toString();
                if (!signalled && output.includes('REST API Listening') && output.includes('Jellyfin emulation server listening')) {
                    signalled = true;
                    child.kill(signal);
                }
            };
            child.stdout.on('data', capture);
            child.stderr.on('data', capture);
            child.on('error', error => { clearTimeout(timer); reject(error); });
            child.on('exit', code => {
                clearTimeout(timer);
                try {
                    assert.ok(!timedOut, `Startup/shutdown timed out:\n${output}`);
                    assert.ok(signalled, `Server exited before listening:\n${output}`);
                    assert.equal(code, 0, `${signal} shutdown failed:\n${output}`);
                    resolve();
                } catch (error) { reject(error instanceof Error ? error : new Error(String(error))); }
            });
        });
        console.log(`Built server starts and shuts down cleanly on ${signal}`);
    }
} finally { await config.cleanup(); }
