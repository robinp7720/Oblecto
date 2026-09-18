import Oblecto from '../lib/oblecto/index.js';
import config, { ConfigManager } from '../config.js';
import { startupProblems } from '../lib/settings/startupChecks.js';
import { prepareDatabase } from './database.js';

const core = {
    oblecto: undefined as Oblecto | undefined,

    /** Check the configuration, bring the database up to date, then start every service. */
    async start(): Promise<void> {
        const problems = startupProblems(config, ConfigManager.loadProblem());

        if (problems.length) throw new Error(`Oblecto cannot start:\n  - ${problems.join('\n  - ')}`);

        await prepareDatabase(config);

        this.oblecto = new Oblecto(config);
    },

    async close(): Promise<void> {
        await this.oblecto?.close();
    },
};

export default core;
