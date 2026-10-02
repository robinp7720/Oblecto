const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const invalidKeys = ['__proto__', 'constructor', 'prototype', 'local'];
export function validateFederation(value: Record<string, unknown>): Record<string, string> {
    const errors: Record<string, string> = {};
    const problem = (key: string, message: string) => { errors[`federation.${key}`] = message; };
    const validPath = (entry: unknown) => typeof entry === 'string' && Boolean(entry.trim()) && !entry.includes('\0');
    const port = (entry: unknown) => Number.isInteger(entry) && Number(entry) > 0 && Number(entry) < 65536;
    for (const field of ['key', 'cert'])
        if (field in value && !validPath(value[field]))
            problem(field, 'Enter a non-empty path without null characters.');
    if ('uuid' in value && (typeof value.uuid !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value.uuid) || invalidKeys.includes(value.uuid)))
        problem('uuid', 'Enter a valid server identity.');
    if ('address' in value && (typeof value.address !== 'string' || (value.address !== '' && !/^[a-zA-Z0-9.:-]{1,253}$/.test(value.address))))
        problem('address', 'Enter a hostname or IP address.');
    if ('syncIntervalMs' in value && (!Number.isSafeInteger(value.syncIntervalMs) || Number(value.syncIntervalMs) < 1000 || Number(value.syncIntervalMs) > 86400000))
        problem('syncIntervalMs', 'Enter a synchronization interval from 1000 to 86400000 milliseconds.');
    if (value.dataPort !== undefined && value.dataPort === value.mediaPort)
        problem('mediaPort', 'Use different ports for metadata and media.');
    for (const group of ['servers', 'clients']) {
        if (!(group in value))
            continue;
        if (!isRecord(value[group])) {
            problem(group, 'Expected a peer map.');
            continue;
        }
        for (const [id, entry] of Object.entries(value[group])) {
            const prefix = `${group}.${id}`;
            if (!id || id.length > 128 || invalidKeys.includes(id)) {
                problem(prefix, 'Invalid peer identifier.');
                continue;
            }
            if (!isRecord(entry)) {
                problem(prefix, 'Expected peer settings.');
                continue;
            }
            if ('enabled' in entry && typeof entry.enabled !== 'boolean')
                problem(`${prefix}.enabled`, 'Expected an on/off value.');
            if (group === 'clients') {
                if (!validPath(entry.key))
                    problem(`${prefix}.key`, 'Enter a public key path.');
            }
            else {
                if (typeof entry.address !== 'string' || !/^[a-zA-Z0-9.:-]{1,253}$/.test(entry.address))
                    problem(`${prefix}.address`, 'Enter a hostname or IP address.');
                if (!validPath(entry.ca))
                    problem(`${prefix}.ca`, 'Enter a trusted certificate path.');
                for (const field of ['dataPort', 'mediaPort'])
                    if (!port(entry[field]))
                        problem(`${prefix}.${field}`, 'Enter a port from 1 to 65535.');
                if ('uuid' in entry && (typeof entry.uuid !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(entry.uuid) || invalidKeys.includes(entry.uuid)))
                    problem(`${prefix}.uuid`, 'Invalid server identity.');
                if ('fingerprint' in entry && (typeof entry.fingerprint !== 'string' || !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(entry.fingerprint)))
                    problem(`${prefix}.fingerprint`, 'Invalid certificate fingerprint');
                if ('name' in entry && (typeof entry.name !== 'string' || entry.name.length > 128))
                    problem(`${prefix}.name`, 'Use a name of up to 128 characters.');
            }
            const allowed = group === 'clients' ? ['key', 'enabled'] : ['address', 'ca', 'dataPort', 'mediaPort', 'uuid', 'fingerprint', 'name', 'enabled'];
            for (const field of Object.keys(entry))
                if (!allowed.includes(field))
                    problem(`${prefix}.${field}`, 'Unknown peer setting.');
        }
    }
    return errors;
}
