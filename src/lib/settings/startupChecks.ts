import { IConfig } from '../../interfaces/config.js';
import { allowedSections, validateSettings } from './validation.js';

const PLACEHOLDER_SECRETS = new Set(['', 'secret']);

/**
 * Reasons the server must not start with this configuration. Empty when it may start.
 * A missing file, an unset or placeholder signing secret, or a mistyped setting all stop startup,
 * because each one otherwise shows up later as an open door or a crash deep in some module.
 */
export function startupProblems(config: IConfig, loadProblem: string | null): string[] {
    const problems: string[] = [];

    if (loadProblem) problems.push(loadProblem);

    const secret: unknown = config.authentication?.secret;

    if (typeof secret !== 'string' || PLACEHOLDER_SECRETS.has(secret.trim()))
        problems.push('authentication.secret is not set. Run "oblecto init" or set it to a long random string.');

    const sections = Object.fromEntries(Object.entries(config).filter(([section]) => allowedSections.includes(section)));

    for (const [field, message] of Object.entries(validateSettings(sections))) problems.push(`${field}: ${message}`);

    return problems;
}
