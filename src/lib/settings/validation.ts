import { parseSubnet } from '../network/localNetwork.js';
import defaults from '../../../res/config.json';

export const allowedSections = [
    'indexer', 'cleaner', 'queue', 'tvdb', 'themoviedb', 'fanart.tv',
    'assets', 'server', 'jellyfin', 'files', 'artwork', 'fileExtensions',
    'transcoding', 'web', 'streaming', 'authentication', 'federation', 'logging',
    'seedboxes', 'movies', 'tvshows'
];
export const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

// Settings the template leaves out because their defaults depend on the machine or are generated.
const OPTIONAL_FIELDS: Record<string, string[]> = {
    streaming: ['cacheDirectory', 'vaapiDevice'],
    federation: ['uuid']
};

const TEMPLATE = defaults as unknown as Record<string, Record<string, unknown>>;

const kind = (value: unknown): string => (Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value);

/**
 * Field-by-field problems with a settings change, keyed by "section.field".
 * @param updates - The sections and fields being changed
 * @param current - The configuration being changed. When given, fields that neither the template,
 *   nor this configuration, nor the known optional settings contain are refused, so a typo cannot
 *   quietly write a setting nothing reads. Startup checks leave it out, so old configs still load.
 */
export function validateSettings(updates: unknown, current?: Record<string, unknown>): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!isRecord(updates) || !Object.keys(updates).length) return { settings: 'Provide settings to update.' };
    for (const [section, value] of Object.entries(updates)) {
        if (!allowedSections.includes(section)) { errors[section] = 'Unknown settings section.'; continue; }
        if (section === 'seedboxes' && Array.isArray(value)) continue;
        if (!isRecord(value)) { errors[section] = 'Expected a settings object.'; continue; }
        if (!Object.keys(value).length) { errors[section] = 'Provide settings to update.'; continue; }
        const template = TEMPLATE[section] ?? {};
        const existing = isRecord(current?.[section]) ? current[section] : {};

        for (const [field, entry] of Object.entries(value)) {
            const key = `${section}.${field}`;
            if (['__proto__', 'constructor', 'prototype'].includes(field)) { errors[key] = 'Invalid field.'; continue; }
            const known = field in template || field in existing || (OPTIONAL_FIELDS[section] ?? []).includes(field);
            if (current && !known) { errors[key] = 'Unknown setting.'; continue; }
            // Same kind of value as the template has, unless a rule below says more precisely what is wrong.
            if (field in template && template[field] !== null && kind(entry) !== kind(template[field])) errors[key] = `Expected ${kind(template[field]) === 'array' ? 'a list' : kind(template[field]) === 'object' ? 'a group of settings' : `a ${kind(template[field])}`}.`;
            if (current && section === 'authentication' && field === 'secret' && entry !== '***' && (typeof entry !== 'string' || entry.trim().length < 16 || entry === 'secret')) errors[key] = 'Use a random value of at least 16 characters.';
            if (field === 'directories' && (!Array.isArray(entry) || entry.some(item => !isRecord(item) || typeof item.path !== 'string' || !item.path.trim() || item.path.includes('\0')))) errors[key] = 'Enter valid library paths.';
            if (section === 'artwork') {
                if (!['poster', 'fanart', 'banner'].includes(field) || !isRecord(entry)) { errors[key] = 'Expected image widths.'; continue; }
                for (const size of ['small', 'medium', 'large']) {
                    if (!Number.isSafeInteger(entry[size]) || Number(entry[size]) <= 0) errors[`${key}.${size}`] = 'Enter a positive whole number of pixels.';
                }
            }
            if (section === 'assets' && field.endsWith('Location') && (typeof entry !== 'string' || !entry.trim() || entry.includes('\0'))) errors[key] = 'Enter a non-empty path without null characters.';
            if (['tvdb', 'themoviedb', 'fanart.tv'].includes(section) && field === 'key' && typeof entry !== 'string') errors[key] = 'Enter a text API key.';
            if (['runAtBoot', 'doHash', 'enable', 'enabled'].includes(field) && typeof entry !== 'boolean') errors[key] = 'Expected an on/off value.';
            if (section === 'authentication' && ['allowPasswordlessLogin', 'profilePicker', 'localPasswordlessLogin', 'trustProxy'].includes(field) && typeof entry !== 'boolean') errors[key] = 'Expected an on/off value.';
            if (section === 'authentication' && field === 'tokenLifetimeDays' && (!Number.isInteger(entry) || Number(entry) < 1 || Number(entry) > 3650)) errors[key] = 'Enter a number of days from 1 to 3650.';
            if (section === 'authentication' && field === 'localSubnets' && (!Array.isArray(entry) || entry.some(item => typeof item !== 'string' || !parseSubnet(item)))) errors[key] = 'Enter subnets like 192.168.1.0/24.';
            if (((section === 'server' || section === 'jellyfin') && field === 'port') && (!Number.isInteger(entry) || Number(entry) < 0 || Number(entry) > 65535)) errors[key] = 'Enter a port from 0 to 65535.';
            if (section === 'server' && field === 'corsOrigins' && (!Array.isArray(entry) || entry.some(item => typeof item !== 'string' || !(item === '*' || /^https?:\/\/[^/]+$/.test(item))))) errors[key] = 'Enter origins like http://localhost:5173, or *.';
            if (section === 'jellyfin' && field === 'host' && (typeof entry !== 'string' || !entry.trim())) errors[key] = 'Enter an address to listen on, such as 0.0.0.0.';
            if (section === 'logging' && field === 'level' && !['error', 'warn', 'info', 'debug'].includes(entry as string)) errors[key] = 'Choose error, warn, info or debug.';
            if (section === 'logging' && ['maxSizeMB', 'maxFiles'].includes(field) && (!Number.isInteger(entry) || Number(entry) < 1)) errors[key] = 'Enter a whole number of at least 1.';
            if (section === 'logging' && field === 'file' && typeof entry !== 'boolean') errors[key] = 'Expected an on/off value.';
            if (section === 'logging' && field === 'directory' && (typeof entry !== 'string' || entry.includes('\0'))) errors[key] = 'Enter a directory path, or leave it empty.';
            if (section === 'federation' && ['dataPort', 'mediaPort'].includes(field) && (!Number.isInteger(entry) || Number(entry) < 1 || Number(entry) > 65535)) errors[key] = 'Enter a port from 1 to 65535.';
            if ((field.endsWith('Identifiers') || field.endsWith('Updaters') || (section === 'fileExtensions' && field === 'video')) && (!Array.isArray(entry) || entry.some(item => typeof item !== 'string' || !item.trim()))) errors[key] = 'Choose a list of non-empty values.';
        }
    }
    return errors;
}

export function mergeSettings(draft: object, updates: Record<string, unknown>): void {
    const target = draft as Record<string, unknown>;
    for (const [section, value] of Object.entries(updates)) {
        if (isRecord(target[section]) && isRecord(value)) {
            // Masked credentials sent back by older clients mean "unchanged".
            const fields = { ...value };
            for (const key of ['secret', 'key', 'password']) if (fields[key] === '***') delete fields[key];
            Object.assign(target[section], fields);
        } else target[section] = value;
    }
}
