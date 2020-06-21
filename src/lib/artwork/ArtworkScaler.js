import sharp from 'sharp';

export default class ImageScaler {
    static async rescaleImage(from, to, size) {
        await sharp(from)
            .resize(size.width, size.height)
            .toFile(to);
    }
}
