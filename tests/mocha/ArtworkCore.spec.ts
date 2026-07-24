import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';

import ArtworkUtils from '../../src/lib/artwork/ArtworkUtils.js';
import ImageScaler from '../../src/lib/artwork/ArtworkScaler.js';
import Queue from '../../src/lib/queue/index.js';

import type Oblecto from '../../src/lib/oblecto/index.js';

const makeConfigOblecto = () => ({
    config: {
        assets: {
            episodeBannerLocation: '/assets/banners',
            showPosterLocation: '/assets/showposters',
            moviePosterLocation: '/assets/movieposters',
            movieFanartLocation: '/assets/moviefanart'
        },
        artwork: {
            banner: { small: 200 },
            poster: { small: 100, medium: 300 },
            fanart: { large: 1000 }
        }
    }
}) as unknown as Oblecto;

describe('ArtworkUtils', () => {
    const utils = new ArtworkUtils(makeConfigOblecto());

    it('builds original-size paths when no size is given', () => {
        assert.equal(utils.moviePosterPath({ id: 5 } as any), '/assets/movieposters/original/5.jpg');
        assert.equal(utils.movieFanartPath({ id: 5 } as any), '/assets/moviefanart/original/5.jpg');
        assert.equal(utils.seriesPosterPath({ id: 7 } as any), '/assets/showposters/original/7.jpg');
        assert.equal(utils.episodeBannerPath({ id: 9 } as any), '/assets/banners/original/9.jpg');
    });

    it('builds sized paths when a configured size is given', () => {
        assert.equal(utils.moviePosterPath({ id: 5 } as any, 'small'), '/assets/movieposters/small/5.jpg');
        assert.equal(utils.movieFanartPath({ id: 5 } as any, 'large'), '/assets/moviefanart/large/5.jpg');
        assert.equal(utils.seriesPosterPath({ id: 7 } as any, 'medium'), '/assets/showposters/medium/7.jpg');
        assert.equal(utils.episodeBannerPath({ id: 9 } as any, 'small'), '/assets/banners/small/9.jpg');
    });

    it('falls back to original when the given size is not configured', () => {
        assert.equal(utils.moviePosterPath({ id: 5 } as any, 'huge'), '/assets/movieposters/original/5.jpg');
        assert.equal(utils.episodeBannerPath({ id: 9 } as any, 'huge'), '/assets/banners/original/9.jpg');
    });

    it('falls back to original when size is an empty string', () => {
        assert.equal(utils.moviePosterPath({ id: 5 } as any, ''), '/assets/movieposters/original/5.jpg');
    });
});

describe('ImageScaler', () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-artwork-scaler-'));
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('registers a rescaleImage job on the queue', () => {
        const queue = new Queue(1);
        new ImageScaler({ queue } as unknown as Oblecto);

        assert.ok((queue as any).jobs.rescaleImage);
    });

    it('resizes an image to the requested dimensions', async () => {
        const from = path.join(tmpDir, 'source.png');
        const to = path.join(tmpDir, 'resized.png');

        await sharp({
            create: { width: 400, height: 300, channels: 3, background: { r: 255, g: 0, b: 0 } }
        }).png().toFile(from);

        await ImageScaler.rescaleImage(from, to, { width: 100, height: 75 });

        const metadata = await sharp(to).metadata();
        assert.equal(metadata.width, 100);
        assert.equal(metadata.height, 75);
    });
});
