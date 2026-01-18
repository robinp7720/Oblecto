import sharp from 'sharp';
import type Oblecto from '../oblecto/index.js';

sharp.cache(false);

type ImageSize = {
    width: number;
    height: number;
};

type RescaleJob = {
    from: string;
    to: string;
    width: number;
    height: number;
};

export default class ImageScaler {
    public oblecto: Oblecto;

    constructor(oblecto: Oblecto) {
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
