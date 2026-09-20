import logger from '../../submodules/logger';
import IdentificationError from '../errors/IdentificationError';

type InformationRetriever = {
    retrieveInformation(...args: unknown[]): Promise<Record<string, unknown>>;
};

export default class AggregateUpdateRetriever {
    private retrievers: InformationRetriever[];

    /**
     * Wrapper class to combine multiple entity updaters and return information as a combined json output
     */
    constructor() {
        this.retrievers = [];
    }

    loadRetriever(retriever: InformationRetriever): void {
        this.retrievers.push(retriever);
    }

    async retrieveInformation(...args: unknown[]): Promise<Record<string, unknown>> {
        const information: Record<string, unknown> = {};

        for (const retriever of this.retrievers) {
            try {
                const currentInformation = await retriever.retrieveInformation(...args);

                // Normalize before merging so an incomplete provider cannot erase a useful value.
                for (const [key, value] of Object.entries(currentInformation)) {
                    if (['siteRating', 'siteRatingCount', 'siteRatingSource'].includes(key)) continue;
                    if (value === undefined || value === null) continue;
                    if (typeof value === 'number' && !Number.isFinite(value)) continue;
                    if (typeof value === 'string' && !value.trim()) continue;
                    if (key === 'genre' || key === 'genres') {
                        if (Array.isArray(value) && value.length === 0) continue;
                        if (typeof value === 'string' && value.replace(/\s/g, '') === '[]') continue;
                    }
                    information[key] = value;
                }
                // A score and its provenance must always come from the same response.
                if (typeof currentInformation.siteRating === 'number' && Number.isFinite(currentInformation.siteRating)) {
                    information.siteRating = currentInformation.siteRating;
                    information.siteRatingCount = typeof currentInformation.siteRatingCount === 'number'
                        && Number.isFinite(currentInformation.siteRatingCount) ? currentInformation.siteRatingCount : null;
                    information.siteRatingSource = currentInformation.siteRatingSource ?? null;
                }
            } catch (e) {
                const entity = args[0];
                const id = typeof entity === 'object' && entity !== null && 'id' in entity ? String(entity.id) : 'unknown';
                logger.error(`${retriever.constructor.name} title ${id}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }

        if (Object.keys(information).length === 0) throw new IdentificationError('No identification match could be found');

        return information;
    }
}
