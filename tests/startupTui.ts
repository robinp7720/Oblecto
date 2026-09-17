import assert from 'node:assert/strict';
import { startupConfig } from './startupConfig.js';

const config = await startupConfig();
process.env.OBLECTO_CONFIG_PATH = config.file;
const timer = setTimeout(() => { console.error('TUI startup/shutdown timed out'); process.exit(1); }, 25000);
try {
    const { default: core } = await import('../src/core/graphical.js');
    core.start();
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.ok(core.oblecto);
    await core.close();
    assert.equal(core.oblecto.playback.sessions.size, 0);
    console.log('TUI starts and awaits playback shutdown');
} catch (error) {
    console.error(error);
    process.exitCode = 1;
} finally {
    clearTimeout(timer);
    await config.cleanup();
}
// The legacy seedbox poller keeps the process alive after the services close.
process.exit(process.exitCode ?? 0);
