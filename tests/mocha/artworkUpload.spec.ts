/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import { promises as fs, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express, { NextFunction, Request, Response } from 'express';
import sharp from 'sharp';
import { Sequelize } from 'sequelize';
import type { UploadedFile } from 'express-fileupload';
import { saveArtwork, ArtworkUploadError } from '../../src/lib/artwork/ArtworkUpload.js';
import movieRoutes from '../../src/submodules/REST/routes/movies.js';
import { MAX_UPLOAD_BYTES } from '../../src/submodules/REST/middleware/upload.js';
import { issueAccessToken } from '../../src/lib/auth/tokens.js';
import { ADMIN_GROUP, seedGroups } from '../../src/lib/auth/permissions.js';
import { User, userColumns } from '../../src/models/user.js';
import { Group, groupColumns } from '../../src/models/group.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { File, fileColumns } from '../../src/models/file.js';
import config from '../../src/config.js';

const image = (width: number, height: number, format: 'png' | 'jpeg' = 'png') => sharp({
    create: {
        width, height, channels: 3, background: { r: 200, g: 40, b: 40 }
    }
})[format]().toBuffer();

describe('Artwork uploads', () => {
    let root: string;
    let jobs: any[];
    let oblecto: any;

    const upload = async (data: Buffer): Promise<UploadedFile> => {
        const tempFilePath = path.join(root, `upload-${Math.random()}`);

        await fs.writeFile(tempFilePath, data);
        return { tempFilePath, data: Buffer.alloc(0) } as unknown as UploadedFile;
    };
    const pathFor = (size?: string) => path.join(root, 'posters', size ?? 'original', '1.jpg');

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-artwork-'));
        jobs = [];
        oblecto = {
            config: { artwork: { poster: { small: 100, large: 1000 }, fanart: { medium: 500 }, banner: { small: 100 } } },
            queue: { pushJob: (id: string, attr: unknown) => jobs.push({ id, attr }) }
        };
    });

    afterEach(() => fs.rm(root, { recursive: true, force: true }));

    it('stores a portrait poster as JPEG and queues every poster size', async () => {
        const file = await upload(await image(200, 300));

        await saveArtwork(oblecto, file, 'poster', pathFor);

        assert.equal((await sharp(pathFor()).metadata()).format, 'jpeg');
        assert.deepEqual(jobs.map(job => [job.id, job.attr.to, job.attr.width]), [
            ['rescaleImage', pathFor('small'), 100],
            ['rescaleImage', pathFor('large'), 1000]
        ]);
        assert.ok(!existsSync(file.tempFilePath), 'temporary file removed');
    });

    it('accepts landscape fanart and episode images, sized from their own settings', async () => {
        await saveArtwork(oblecto, await upload(await image(320, 180)), 'fanart', pathFor);
        await saveArtwork(oblecto, await upload(await image(320, 180, 'jpeg')), 'banner', pathFor);

        assert.deepEqual(jobs.map(job => job.attr.width), [500, 100]);
    });

    it('rejects the wrong shape, non-images and missing files, and still removes the upload', async () => {
        const landscapePoster = await upload(await image(320, 180));
        const notAnImage = await upload(Buffer.from('not an image'));

        await assert.rejects(saveArtwork(oblecto, landscapePoster, 'poster', pathFor), (error: ArtworkUploadError) => error.statusCode === 422 && /portrait/.test(error.message));
        await assert.rejects(saveArtwork(oblecto, await upload(await image(200, 300)), 'fanart', pathFor), /landscape/);
        await assert.rejects(saveArtwork(oblecto, notAnImage, 'poster', pathFor), (error: ArtworkUploadError) => error.statusCode === 422 && error.message === 'File is not an image');
        await assert.rejects(saveArtwork(oblecto, undefined, 'poster', pathFor), (error: ArtworkUploadError) => error.statusCode === 400);

        assert.ok(!existsSync(landscapePoster.tempFilePath));
        assert.ok(!existsSync(notAnImage.tempFilePath));
        assert.ok(!existsSync(pathFor()));
        assert.equal(jobs.length, 0);
    });

    describe('PUT /movie/:id/poster', () => {
        let sequelize: Sequelize;
        let server: Server;
        let base: string;
        let admin: User;
        let viewer: User;
        let movie: Movie;

        const put = (user: User | null, form: FormData) => fetch(`${base}/movie/${movie.id}/poster`, {
            method: 'PUT',
            headers: user ? { Authorization: `Bearer ${issueAccessToken(user, config.authentication)}` } : {},
            body: form
        });
        const form = (data: Buffer) => {
            const body = new FormData();

            body.append('image', new Blob([new Uint8Array(data)]), 'poster.png');
            return body;
        };

        before(async () => {
            sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
            User.init(userColumns, { sequelize, modelName: 'User' });
            Group.init(groupColumns, { sequelize, modelName: 'Group' });
            Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
            File.init(fileColumns, { sequelize, modelName: 'File' });
            if (!Movie.associations.Files) Movie.belongsToMany(File, { through: 'MovieFiles' });
            if (!File.associations.Movies) File.belongsToMany(Movie, { through: 'MovieFiles' });
            await sequelize.sync({ force: true });
            await seedGroups();

            const admins = (await Group.findOne({ where: { name: ADMIN_GROUP } }))!;

            admin = await User.create({ username: 'admin', name: 'Admin', email: null, password: null, avatar: null, groupId: admins.id });
            viewer = await User.create({ username: 'viewer', name: 'Viewer', email: null, password: null, avatar: null, groupId: null });
            movie = await Movie.create({ movieName: 'Poster test' } as any);
        });

        beforeEach(async () => {
            oblecto.config.assets = { moviePosterLocation: path.join(root, 'moviePosters') };
            oblecto.artworkUtils = { moviePosterPath: (_movie: Movie, size?: string) => path.join(root, 'moviePosters', size ?? 'original', `${movie.id}.jpg`) };

            const app = express();

            app.use((req: any, _res: Response, next: NextFunction) => {
                const [scheme, credentials] = (req.headers.authorization ?? '').split(' ');

                if (credentials) req.authorization = { scheme, credentials };
                next();
            });
            movieRoutes(app, oblecto);
            app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
                res.status((err.statusCode as number) || 500).json({ message: err.message });
            });
            server = app.listen(0, '127.0.0.1');
            await new Promise(resolve => server.once('listening', resolve));
            base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        });

        afterEach(() => new Promise(resolve => server.close(resolve)));
        after(() => sequelize.close());

        it('stores the poster for a user who manages libraries', async () => {
            const response = await put(admin, form(await image(200, 300)));

            assert.equal(response.status, 200);
            assert.equal((await sharp(path.join(root, 'moviePosters', 'original', `${movie.id}.jpg`)).metadata()).format, 'jpeg');
        });

        it('refuses anonymous and unprivileged uploads', async () => {
            assert.equal((await put(null, form(await image(200, 300)))).status, 401);
            assert.equal((await put(viewer, form(await image(200, 300)))).status, 403);
        });

        it('answers 422 with a reason for a landscape poster', async () => {
            const response = await put(admin, form(await image(320, 180)));

            assert.equal(response.status, 422);
            assert.match(((await response.json()) as { message: string }).message, /portrait/);
        });

        it('refuses files over the size limit', async () => {
            const response = await put(admin, form(Buffer.alloc(MAX_UPLOAD_BYTES + 1024)));

            assert.equal(response.status, 413);
        });
    });
});
