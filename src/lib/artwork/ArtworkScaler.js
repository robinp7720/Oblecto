import sharp from 'sharp';

export default class ImageScaler {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.oblecto.queue.addJob('rescaleImage', async (job) => {
            await ImageScaler.rescaleImage(job.from, job.to, {
                width: job.width,
                height: job.height
            });
        });
    }

    static async rescaleImage(from, to, size) {
        await sharp(from)
            .resize(size.width, size.height)
            .toFile(to);
    }
}
