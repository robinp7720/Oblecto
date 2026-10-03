import { spawn } from 'node:child_process';

/**
 * Run a program without a shell and collect its output as bytes. Rejects with the end of stderr
 * when it fails, is cancelled or runs past `timeoutMs`.
 * @param binary - Program to run
 * @param args - Its arguments
 * @param signal - Cancels the work
 * @param timeoutMs - Longest it may run
 */
export function runBinary(binary: string, args: string[], signal?: AbortSignal, timeoutMs = 10 * 60 * 1000): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new Error('Cancelled'));

        const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        const chunks: Buffer[] = [];
        let size = 0;
        let stderr = '';
        let failure: Error | undefined;
        let killTimer: NodeJS.Timeout | undefined;
        const stop = (error: Error): void => {
            failure ??= error;
            child.kill('SIGTERM');
            killTimer ??= setTimeout(() => child.kill('SIGKILL'), 1500);
        };
        const abort = (): void => stop(new Error('Cancelled'));
        const timer = setTimeout(() => stop(new Error(`${binary} took longer than ${Math.round(timeoutMs / 1000)} seconds`)), timeoutMs);

        signal?.addEventListener('abort', abort, { once: true });
        child.stdout.on('data', (data: Buffer) => {
            size += data.length;
            if (size > 256 * 1024 * 1024) stop(new Error(`${binary} produced more output than expected`));
            else chunks.push(data);
        });
        child.stderr.on('data', (data: Buffer) => {
            stderr = (stderr + data.toString()).slice(-4096);
        });
        child.on('error', error => { failure ??= error; });
        child.on('close', code => {
            clearTimeout(timer);
            if (killTimer) clearTimeout(killTimer);
            signal?.removeEventListener('abort', abort);

            if (failure) reject(failure);
            else if (code !== 0) reject(new Error(stderr.trim().split('\n').at(-1) || `${binary} exited with code ${code}`));
            else resolve(Buffer.concat(chunks));
        });
    });
}
