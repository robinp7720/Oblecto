import type { Request } from 'express';

type EmbyHeaders = Request['headers'] & {
    emby?: Record<string, string>;
    'x-emby-token'?: string;
    'x-mediabrowser-token'?: string;
    'x-emby-authorization'?: string;
};

type EmbyRequest = Request & {
    headers: EmbyHeaders;
};

export const getRequestValue = (req: EmbyRequest, ...keys: string[]): string | undefined => {
    const lowered = keys.map(key => String(key).toLowerCase());
    const sources: Record<string, unknown>[] = [
        (req.query as Record<string, unknown>) ?? {},
        (req.body as Record<string, unknown>) ?? {}
    ];

    for (const source of sources) {
        for (const [name, value] of Object.entries(source)) {
            if (!lowered.includes(name.toLowerCase())) continue;
            if (Array.isArray(value)) return String(value[0]);
            return value as string;
        }
    }

    return undefined;
};

export const getEmbyToken = (req: EmbyRequest): string | undefined => {
    if (req?.headers?.emby?.Token !== undefined && req?.headers?.emby?.Token !== '') return req.headers.emby.Token;

    const headerToken = req?.headers?.['x-emby-token']
        ?? req?.headers?.['x-mediabrowser-token']
        ?? req?.headers?.['x-emby-authorization'];

    if (headerToken !== undefined && headerToken !== '') {
        const match = /(?:^|[, ])Token="([^"]+)"/i.exec(headerToken);
        return match ? match[1] : headerToken.trim();
    }

    return getRequestValue(req, 'ApiKey', 'api_key', 'apikey');
};

/**
 * Every value a list parameter carries: repeated keys (?Fields=a&Fields=b) and separated values
 * (?Fields=a,b) alike, empty entries dropped. Keys match case-insensitively.
 * @param req - The request
 * @param key - The parameter
 * @param separator - What separates values; Jellyfin uses "|" for names, which can contain commas
 */
export const getRequestList = (req: EmbyRequest, key: string, separator = ','): string[] => {
    const lowered = key.toLowerCase();
    const values: string[] = [];

    for (const source of [(req.query as Record<string, unknown>) ?? {}, (req.body as Record<string, unknown>) ?? {}]) {
        for (const [name, value] of Object.entries(source)) {
            if (name.toLowerCase() !== lowered || value === undefined || value === null) continue;
            for (const entry of Array.isArray(value) ? value : [value]) values.push(String(entry));
        }
    }

    return values
        .flatMap(value => value.split(separator))
        .map(value => value.trim())
        .filter(value => value.length > 0);
};
