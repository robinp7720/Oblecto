import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import type { UploadedFile } from 'express-fileupload';
import type Oblecto from '../oblecto/index.js';

export type ArtworkKind = 'poster' | 'fanart' | 'banner';

// Accepted height / width, so a poster is not stretched into a backdrop slot or the other way round.
type Shape = { min: number; max: number; expected: string };

const PORTRAIT: Shape = {
    min: 1,
    max: 2,
    expected: 'portrait, like 2:3'
};

const LANDSCAPE: Shape = {
    min: 0.4,
    max: 0.8,
    expected: 'landscape, like 16:9'
};

const SHAPES: Record<ArtworkKind, Shape> = {
    poster: PORTRAIT,
    fanart: LANDSCAPE,
    banner: LANDSCAPE
};

export class ArtworkUploadError extends Error {
    // Picked up by the REST error handler
    constructor(message: string, public statusCode: number) {
        super(message);
        this.name = 'ArtworkUploadError';
    }
}

/**
 * Store an uploaded image as an item's artwork and queue its scaled copies.
 * The upload is re-encoded to JPEG, since artwork paths end in .jpg whatever was sent,
 * and its temporary file is removed whether or not it was accepted.
 * @param oblecto - Oblecto instance, for the artwork sizes and the job queue
 * @param upload - The uploaded file
 * @param kind - Which artwork this is, which decides its shape and sizes
 * @param pathFor - Where the original (no size) and each scaled size live
 */
export async function saveArtwork(
    oblecto: Oblecto,
    upload: UploadedFile | undefined,
    kind: ArtworkKind,
    pathFor: (size?: string) => string
): Promise<void> {
    if (!upload) throw new ArtworkUploadError('Image file is missing', 400);

    const source = upload.tempFilePath || upload.data;

    try {
        let width: number;
        let height: number;

        try {
            ({ width, height } = await sharp(source).rotate().metadata().then(meta => ({ width: meta.width ?? 0, height: meta.height ?? 0 })));
        } catch {
            throw new ArtworkUploadError('File is not an image', 422);
        }

        const ratio = height / (width || 1);
        const shape = SHAPES[kind];

        if (ratio < shape.min || ratio > shape.max)
            throw new ArtworkUploadError(`The image should be ${shape.expected}`, 422);

        const original = pathFor();

        await fs.mkdir(path.dirname(original), { recursive: true });
        await sharp(source).rotate().jpeg({ quality: 90 }).toFile(original);

        const sizes = oblecto.config.artwork[kind] as Record<string, number>;

        for (const [size, sizeWidth] of Object.entries(sizes)) {
            await fs.mkdir(path.dirname(pathFor(size)), { recursive: true });
            oblecto.queue.pushJob('rescaleImage', {
                from: original,
                to: pathFor(size),
                width: sizeWidth
            });
        }
    } finally {
        if (upload.tempFilePath) await fs.rm(upload.tempFilePath, { force: true });
    }
}
