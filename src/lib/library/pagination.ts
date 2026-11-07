import { Op } from 'sequelize';

export function buildCursorWhere(sortField: string, order: 'asc' | 'desc', sortValue: unknown, id: number): Record<string, unknown> {
    const sortOp = order === 'asc' ? Op.gt : Op.lt;
    const idOp = order === 'asc' ? Op.gt : Op.lt;

    if (sortValue === null || sortValue === undefined) {
        return {
            [Op.or]: [
                {
                    [sortField]: null,
                    id: {[idOp]: id}
                },
                {[sortField]: {[Op.not]: null}}
            ]
        };
    }

    return {
        [Op.or]: [
            {[sortField]: {[sortOp]: sortValue}},
            {
                [sortField]: sortValue,
                id: {[idOp]: id}
            }
        ]
    };
}
