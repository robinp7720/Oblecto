export type SeedboxStorageDriverConfig = {
    host: string;
    username: string;
    password: string;
    secure?: boolean;
    port?: number;
};

export type SeedboxListEntry = {
    name: string;
    type: number;
};

export default class SeedboxImportDriver {
    public config: SeedboxStorageDriverConfig;

    constructor(seedboxStorageDriverOptions: SeedboxStorageDriverConfig) {
        this.config = seedboxStorageDriverOptions;
    }

    async setup(): Promise<void> {
        // implemented by subclasses
    }

    async list(path: string): Promise<SeedboxListEntry[]> {
        void path;
        return [];
    }

    async copy(origin: string, destination: string): Promise<void> {
        void origin;
        void destination;
    }
}
