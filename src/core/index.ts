import Oblecto from '../lib/oblecto/index.js';
import config, { ConfigManager } from '../config.js';
import { startupProblems } from '../lib/settings/startupChecks.js';

const problems = startupProblems(config, ConfigManager.loadProblem());

if (problems.length) {
    console.error('Oblecto cannot start:');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
}

const core = {
    oblecto: new Oblecto(config),

    start(): void {
        // The Oblecto instance is already initialized in the constructor
        // No additional initialization needed as the REST API and other components
        // are already set up in the Oblecto constructor
    },

    async close(): Promise<void> {
        await this.oblecto.close();
    },
};

export default core;
