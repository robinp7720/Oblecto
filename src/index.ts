import core from './core/index.js';
import { installLifecycle } from './core/lifecycle.js';

installLifecycle(() => core.close());

core.start().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
