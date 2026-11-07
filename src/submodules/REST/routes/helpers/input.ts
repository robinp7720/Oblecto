import errors from '../../errors.js';

export function positiveId(value: unknown, name = 'id'): number {
    if (!((typeof value === 'string' && /^\d+$/.test(value.trim())) || typeof value === 'number') || !Number.isSafeInteger(Number(value)) || Number(value) < 1)
        throw new errors.BadRequestError(`${name} must be a positive integer`);
    return Number(value);
}
