import { Op } from 'sequelize';

export function buildCursorWhere(sortField: string, order: 'asc' | 'desc', sortValue: unknown, id: number): Record<string, unknown> {
    const comparison = order === 'asc' ? Op.gt : Op.lt;
    const sameValue = { [sortField]: sortValue ?? null, id: { [comparison]: id } };

    // SQLite and MySQL place NULLs first in ascending order and last in descending order.
    if (sortValue === null || sortValue === undefined) {
        return order === 'asc'
            ? { [Op.or]: [sameValue, { [sortField]: { [Op.not]: null } }] }
            : sameValue;
    }
    const laterValues = [{ [sortField]: { [comparison]: sortValue } }, sameValue];
    if (order === 'desc') return { [Op.or]: [...laterValues, { [sortField]: null }] };
    return { [Op.or]: laterValues };
}
