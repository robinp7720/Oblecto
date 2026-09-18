import axios, { type AxiosRequestConfig } from 'axios';
import { isRecord } from './validation.js';

export const providers = ['themoviedb', 'tvdb', 'fanart.tv'] as const;
type Provider = typeof providers[number];
type Result = { ok: boolean; code: string; message: string };

const result = (ok: boolean, code: string, message: string): Result => ({
    ok,
    code,
    message
});

/** Uses the same API generations as the installed metadata clients. */
export async function testProvider(provider: Provider, key: string, request = (options: AxiosRequestConfig) => axios.request(options)): Promise<Result> {
    if (!key.trim()) return result(false, 'missing_key', 'Save an API key before testing.');
    const requests: Record<Provider, AxiosRequestConfig> = {
        themoviedb: { url: 'https://api.themoviedb.org/3/authentication', params: { api_key: key } },
        tvdb: {
            method: 'POST',
            url: 'https://api.thetvdb.com/login',
            data: { apikey: key }
        },
        'fanart.tv': { url: 'https://webservice.fanart.tv/v3/movies/550', params: { api_key: key } }
    };
    try {
        const response = await request({
            ...requests[provider],
            timeout: 8000,
            maxRedirects: 0
        });
        const data: unknown = response.data;
        if (!isRecord(data)) return result(false, 'service_error', 'The provider returned an unexpected response. Try again later.');
        if (data.success === false || data.status === 'error' || Boolean(data.error)) {
            return result(false, 'provider_error', 'The provider rejected the request. Check your key and service access.');
        }
        const valid = provider === 'tvdb'
            ? typeof data.token === 'string' && data.token.length > 0
            : provider === 'themoviedb' ? data.success === true : typeof data.name === 'string';
        if (!valid) return result(false, 'service_error', 'The provider API used by this server did not return a valid response.');
        return result(true, 'connected', 'Connection successful using the saved key.');
    } catch (error: unknown) {
        const failure = error as { response?: { status: number }; code?: string } | null;
        const status = failure?.response?.status;
        if (status === 401 || status === 403) return result(false, 'invalid_key', 'Credentials were rejected. Check your saved key and account access.');
        if (status === 429) return result(false, 'rate_limited', 'The provider rate limit was reached. Try again later.');
        if (failure?.code === 'ECONNABORTED' || failure?.code === 'ETIMEDOUT') return result(false, 'timeout', 'The provider timed out. Try again.');
        return result(false, 'service_error', 'Could not reach the provider API used by this server. Check connectivity and provider availability.');
    }
}
