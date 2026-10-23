import IdentificationError from '../errors/IdentificationError.js';
import logger from '../../submodules/logger/index.js';

type Identifier = {
    // Method syntax on purpose: each identifier narrows the arguments it accepts.
    identify(...args: unknown[]): Promise<object | undefined>;
};

export default class AggregateIdentifier {
    private identifiers: Identifier[];

    /**
     * Wrapper class to combine multiple identifiers and return information as a combined json output
     */
    constructor() {
        this.identifiers = [];
    }

    /**
     * Load another MediaIdentifier to be used
     * @param identifier - Identifier object
     */
    loadIdentifier(identifier: Identifier): void {
        this.identifiers.push(identifier);
    }

    async identify(...args: unknown[]): Promise<Record<string, unknown>> {
        let identification: Record<string, unknown> = {};
        const failures: string[] = [];

        for (const identifier of this.identifiers) {
            let currentIdentification: Record<string, unknown>;

            try {
                currentIdentification = { ...(await identifier.identify(...args)) } as Record<string, unknown>;
            } catch (e) {
                logger.debug("Failed to identify", args, e);
                failures.push(AggregateIdentifier.describeFailure(identifier, e));
                continue;
            }

            // Normalize each response before merging so missing values cannot erase earlier matches.
            for (const [key, value] of Object.entries(currentIdentification)) {
                if (value === undefined || value === null
                    || (typeof value === 'string' && !value.trim())
                    || (typeof value === 'number' && !Number.isFinite(value))) {
                    delete currentIdentification[key];
                }
            }

            identification = { ...identification, ...currentIdentification };
        }

        if (Object.keys(identification).length === 0) {
            // Keep each identifier's reason: "TMDB timed out" calls for a
            // retry, "no results" calls for renaming the file.
            const reasons = failures.length > 0 ? ` (${failures.join('; ')})` : '';

            logger.info(`Could not identify: ${String(args[0])}${reasons}`);
            throw new IdentificationError(`Could not identify: ${String(args[0])}${reasons}`);
        }

        return identification;
    }

    private static describeFailure(identifier: Identifier, error: unknown): string {
        const name = identifier.constructor.name.replace(/Identifier$/, '');
        const message = error instanceof Error ? error.message : String(error);

        return message ? `${name}: ${message}` : name;
    }
}
