/** Dependencies outlive their users, including during a partially failed startup. */
export type ShutdownPhase = 'intake' | 'producers' | 'jobs' | 'playback' | 'connections' | 'persistence' | 'database';
const PHASES: ShutdownPhase[] = ['intake', 'producers', 'jobs', 'playback', 'connections', 'persistence', 'database'];

export class ServiceLifecycle {
    private cleanups: { name: string; phase: ShutdownPhase; close: () => void | Promise<void> }[] = [];
    private starting?: Promise<void>;
    private closing?: Promise<void>;
    private disposing?: Promise<void>;

    /** Register cleanup immediately after acquiring a resource, before starting the next one. */
    defer(name: string, phase: ShutdownPhase, close: () => void | Promise<void>): void {
        this.cleanups.push({
            name, phase, close
        });
    }

    start(initialize: () => Promise<void>): Promise<void> {
        if (this.closing || this.disposing) return Promise.reject(new Error('Oblecto is stopping or has stopped'));
        this.starting ??= Promise.resolve().then(initialize).catch(async (error: unknown) => {
            try {
                await this.dispose();
            } catch (cleanupError) {
                throw new AggregateError([error, cleanupError], `Startup failed: ${String(error)}; ${String(cleanupError)}`, { cause: error });
            }
            throw error;
        });
        return this.starting;
    }

    close(): Promise<void> {
        this.closing ??= (async () => {
            // Initialization owns resource acquisition. Never finish shutdown while it can still
            // register a listener, timer or database user. Failed startup performs the same cleanup.
            await this.starting?.catch(() => {});
            await this.dispose();
        })();
        return this.closing;
    }

    private dispose(): Promise<void> {
        this.disposing ??= (async () => {
            const failures: Error[] = [];
            for (const phase of PHASES) {
                for (const resource of this.cleanups.filter(entry => entry.phase === phase).reverse()) {
                    try {
                        await resource.close();
                    } catch (cause) {
                        failures.push(new Error(`Could not close ${resource.name}: ${String(cause)}`, { cause }));
                    }
                }
            }
            if (failures.length) throw new AggregateError(failures, failures.map(error => error.message).join('; '));
        })();
        return this.disposing;
    }
}
