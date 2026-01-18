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
    const sources = [req.query || {}, req.body || {}];

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
    if (req?.headers?.emby?.Token) return req.headers.emby.Token;

    const headerToken = req?.headers?.['x-emby-token']
        || req?.headers?.['x-mediabrowser-token']
        || req?.headers?.['x-emby-authorization'];

    if (headerToken && typeof headerToken === 'string' && headerToken.trim()) {
        return headerToken.trim();
    }

    return getRequestValue(req, 'ApiKey', 'api_key', 'apikey');
};
