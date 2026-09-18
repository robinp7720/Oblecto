// Slows password guessing. Only failed sign-ins count, and the tight limit is per address and
// account together, so someone guessing at an account cannot lock its owner out from elsewhere.

const WINDOW_MS = 15 * 60 * 1000;
// Failures allowed for one account from one address, and from one address across all accounts.
const PER_ACCOUNT = 5;
const PER_ADDRESS = 20;

type Bucket = { failures: number; resetAt: number };

export class LoginThrottle {
    private buckets = new Map<string, Bucket>();

    constructor(private now: () => number = Date.now) {}

    private keys(address: string | undefined, account: string | undefined): [string, number][] {
        const from = address ?? 'unknown';

        return [
            [`address:${from}`, PER_ADDRESS],
            [`account:${from}:${(account ?? '').toLowerCase()}`, PER_ACCOUNT]
        ];
    }

    private live(key: string): Bucket | undefined {
        const bucket = this.buckets.get(key);

        if (bucket && bucket.resetAt <= this.now()) {
            this.buckets.delete(key);
            return undefined;
        }

        return bucket;
    }

    /** Seconds until this address may try this account again, or 0 when it may try now. */
    retryAfter(address: string | undefined, account: string | undefined): number {
        let wait = 0;

        for (const [key, limit] of this.keys(address, account)) {
            const bucket = this.live(key);

            if (bucket && bucket.failures >= limit) wait = Math.max(wait, Math.ceil((bucket.resetAt - this.now()) / 1000));
        }

        return wait;
    }

    failed(address: string | undefined, account: string | undefined): void {
        for (const [key] of this.keys(address, account)) {
            const bucket = this.live(key) ?? { failures: 0, resetAt: this.now() + WINDOW_MS };

            bucket.failures += 1;
            this.buckets.set(key, bucket);
        }

        // Drop expired entries now and then so the map cannot grow without bound.
        if (this.buckets.size > 10000) for (const key of [...this.buckets.keys()]) this.live(key);
    }

    succeeded(address: string | undefined, account: string | undefined): void {
        this.buckets.delete(this.keys(address, account)[1][0]);
    }
}

// One throttle for the web sign-in and the Jellyfin one, so switching between them does not reset it.
export const loginThrottle = new LoginThrottle();
