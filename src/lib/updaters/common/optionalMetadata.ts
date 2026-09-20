import logger from '../../../submodules/logger/index.js';

/** Optional provider requests must not discard successfully fetched title metadata. */
export async function optionalMetadata<T>(request: () => Promise<T>, context: string, validate: (value: T) => boolean = () => true): Promise<T | undefined> {
    try {
        const result = await request();
        if (!validate(result)) throw new Error('Malformed provider response');
        return result;
    } catch (error) {
        logger.warn(`${context}: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}

/** Missing or malformed lists are not an authoritative empty credit response. */
export function validCreditLists(value: unknown, first = 'cast', second = 'crew'): boolean {
    if (typeof value !== 'object' || value === null) return false;
    const data = value as Record<string, unknown>;

    return [first, second].every(key => Array.isArray(data[key]) && data[key].every(
        (entry: unknown) => typeof entry === 'object' && entry !== null
            && typeof (entry as Record<string, unknown>).id === 'number'
            && Number.isInteger((entry as Record<string, unknown>).id)
            && Number((entry as Record<string, unknown>).id) > 0
            && typeof (entry as Record<string, unknown>).name === 'string'
            && String((entry as Record<string, unknown>).name).trim().length > 0
            && ['roles', 'jobs'].every(field => {
                const roles = (entry as Record<string, unknown>)[field];
                return roles === undefined || (Array.isArray(roles) && roles.every(role => typeof role === 'object' && role !== null));
            })
    ));
}
