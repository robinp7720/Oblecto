export const getRequestValue = (req, ...keys) => {
    const lowered = keys.map(key => String(key).toLowerCase());
    const sources = [req.query || {}, req.body || {}];

    for (const source of sources) {
        for (const [name, value] of Object.entries(source)) {
            if (!lowered.includes(name.toLowerCase())) continue;
            if (Array.isArray(value)) return value[0];
            return value;
        }
    }

    return undefined;
};

export const getEmbyToken = (req) => {
    if (req?.headers?.emby?.Token) return req.headers.emby.Token;

    const headerToken = req?.headers?.['x-emby-token']
        || req?.headers?.['x-mediabrowser-token']
        || req?.headers?.['x-emby-authorization'];

    if (headerToken && typeof headerToken === 'string' && headerToken.trim()) {
        return headerToken.trim();
    }

    return getRequestValue(req, 'ApiKey', 'api_key', 'apikey');
};
