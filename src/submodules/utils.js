import { promises as fs } from 'fs';

export const fileExists = async (path) => {
    try {
        await fs.stat(path);
    } catch (e) {
        return false;
    }

    return true;
};
