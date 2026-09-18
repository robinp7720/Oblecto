export const allowedSections = [
    'indexer', 'cleaner', 'mdns', 'queue', 'tvdb', 'themoviedb', 'fanart.tv',
    'assets', 'server', 'files', 'artwork', 'fileExtensions', 'tracker',
    'transcoding', 'web', 'streaming', 'authentication', 'federation',
    'seedboxes', 'movies', 'tvshows'
];
export const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateSettings(updates: unknown): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!isRecord(updates) || !Object.keys(updates).length) return { settings: 'Provide settings to update.' };
    for (const [section, value] of Object.entries(updates)) {
        if (!allowedSections.includes(section)) { errors[section] = 'Unknown settings section.'; continue; }
        if (section === 'seedboxes' && Array.isArray(value)) continue;
        if (!isRecord(value)) { errors[section] = 'Expected a settings object.'; continue; }
        if (!Object.keys(value).length) { errors[section] = 'Provide settings to update.'; continue; }
        for (const [field, entry] of Object.entries(value)) {
            const key = `${section}.${field}`;
            if (['__proto__', 'constructor', 'prototype'].includes(field)) errors[key] = 'Invalid field.';
            if (field === 'directories' && (!Array.isArray(entry) || entry.some(item => !isRecord(item) || typeof item.path !== 'string' || !item.path.trim() || item.path.includes('\0')))) errors[key] = 'Enter valid library paths.';
            if (section === 'artwork') {
                if (!['poster', 'fanart', 'banner'].includes(field) || !isRecord(entry)) { errors[key] = 'Expected image widths.'; continue; }
                for (const size of ['small', 'medium', 'large']) {
                    if (!Number.isSafeInteger(entry[size]) || Number(entry[size]) <= 0) errors[`${key}.${size}`] = 'Enter a positive whole number of pixels.';
                }
            }
            if (section === 'assets' && field.endsWith('Location') && (typeof entry !== 'string' || !entry.trim() || entry.includes('\0'))) errors[key] = 'Enter a non-empty path without null characters.';
            if (['tvdb', 'themoviedb', 'fanart.tv'].includes(section) && field === 'key' && typeof entry !== 'string') errors[key] = 'Enter a text API key.';
            if (['runAtBoot', 'doHash', 'storeWithFile', 'doReIndex', 'indexBroken', 'ignoreSeriesMismatch', 'enable'].includes(field) && typeof entry !== 'boolean') errors[key] = 'Expected an on/off value.';
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
