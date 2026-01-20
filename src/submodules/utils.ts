import { promises as fs } from 'fs';

export const fileExists = async (path: string): Promise<boolean> => {
    try {
        await fs.stat(path);
    } catch {
        return false;
    }

    return true;
};
