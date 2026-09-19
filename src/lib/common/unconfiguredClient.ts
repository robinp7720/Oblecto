/**
 * Stands in for a metadata provider client when its API key is not set. Every call rejects with an
 * error naming the missing setting, so identification and updates fail per file with a readable
 * reason instead of the server refusing to start.
 */
export function unconfiguredClient<T>(provider: string, setting: string): T {
    const fail = (): Promise<never> => Promise.reject(new Error(`No ${provider} API key is set (${setting})`));

    return new Proxy({}, { get: (_target, property) => (property === 'then' ? undefined : fail) }) as T;
}
