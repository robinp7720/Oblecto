import core from './core/index.js';
import { installLifecycle } from './core/lifecycle.js';

installLifecycle(() => core.close());

core.start();
