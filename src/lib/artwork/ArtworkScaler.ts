import sharp from 'sharp';
import type { Dependencies } from '../contracts.js';

type ServiceDependencies = Dependencies<'queue', never>;

sharp.cache(false);

type ImageSize = {
    width: number;
    height?: number;
};

type RescaleJob = {
    from: string;
    to: string;
    width: number;
    height?: number;
};

export default class ImageScaler {
    public oblecto: ServiceDependencies;

    constructor(oblecto: ServiceDependencies) {
        this.oblecto = oblecto;

        this.oblecto.queue.registerJob('rescaleImage', async (job: RescaleJob) => {
            await ImageScaler.rescaleImage(job.from, job.to, {
                width: job.width,
                height: job.height
            });
        });
    }

    static async rescaleImage(from: string, to: string, size: ImageSize): Promise<void> {
        await sharp(from)
            .resize(size.width, size.height)
            .toFile(to);
    }
}
