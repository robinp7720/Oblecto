/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/strict-boolean-expressions */
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import streamingRoutes from '../../src/submodules/REST/routes/streaming.js';
import { File, fileColumns } from '../../src/models/file.js';
import { Stream, streamColumns } from '../../src/models/stream.js';

const makeServer = () => {
    const handlers = new Map();

    const register = (method: string) => (route: string, ...routeHandlers: any[]) => {
        handlers.set(`${method} ${route}`, routeHandlers[routeHandlers.length - 1]);
    };

    return {
        handlers,
        get: register('GET'),
        post: register('POST'),
        put: register('PUT'),
        delete: register('DELETE')
    };
};

const makeRes = () => ({
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string>,
    setHeader(key: string, value: string) {
        this.headers[key] = value;
    },
    status(code: number) {
        this.statusCode = code;
        return this;
    },
    send(payload: any) {
        this.body = payload;
        return this;
    }
});

describe('Streaming session create route', () => {
    let sequelize: Sequelize;
    let createdOptions: any = null;

    before(async () => {
        sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

        File.init(fileColumns, { sequelize, modelName: 'File' });
        Stream.init(streamColumns, { sequelize, modelName: 'Stream' });

        File.hasMany(Stream);
        Stream.belongsTo(File);

        await sequelize.sync({ force: true });

        const file = await File.create({
            path: '/tmp/movie.mkv',
            host: 'local',
            videoCodec: 'h264',
            audioCodec: 'aac'
        });

        await Stream.create({ FileId: file.id, index: 0, codec_type: 'video', codec_name: 'h264' });
        await Stream.create({ FileId: file.id, index: 1, codec_type: 'audio', codec_name: 'aac', tags_language: 'eng' });
        await Stream.create({ FileId: file.id, index: 2, codec_type: 'audio', codec_name: 'aac', tags_language: 'jpn' });
        await Stream.create({ FileId: file.id, index: 3, codec_type: 'subtitle', codec_name: 'subrip', tags_language: 'eng' });
    });

    it('creates session with explicit audio/subtitle indexes and returns selectedTracks', async () => {
        const server = makeServer();
        const mockOblecto = {
            streamSessionController: {
                sessionExists: () => false,
                sessions: {},
                newSession: (file: any, options: any) => {
                    createdOptions = options;
                    return {
                        sessionId: 'session-123',
                        videoCodec: 'h264',
                        audioCodec: 'aac',
                        file,
                        selectedAudioStreamIndex: options.audioStreamIndex ?? null,
                        selectedSubtitleStreamIndex: options.subtitleStreamIndex ?? null,
                        subtitleMode: options.subtitleMode ?? 'auto'
                    };
                }
            }
        };

        streamingRoutes(server as any, mockOblecto as any);

        const handler = server.handlers.get('GET /session/create/:id');
        const res = makeRes();
        const req = {
            params: { id: '1' },
            combined_params: {
                type: 'hls',
                formats: 'mp4',
                videoCodecs: 'h264',
                audioCodec: 'aac',
                audioStreamIndex: '2',
                subtitleStreamIndex: '3',
                subtitleMode: 'auto'
            }
        };

        await handler(req, res, (error: any) => {
            throw error;
        });

        assert.equal(res.statusCode, 200);
        assert.equal(createdOptions.audioStreamIndex, 2);
        assert.equal(createdOptions.subtitleStreamIndex, 3);
        assert.equal(createdOptions.subtitleMode, 'auto');
        assert.equal(res.body.selectedTracks.audioStreamIndex, 2);
        assert.equal(res.body.selectedTracks.subtitleStreamIndex, 3);
        assert.equal(res.body.selectedTracks.subtitleMode, 'auto');
    });

    it('disables subtitles when subtitleStreamIndex is -1', async () => {
        const server = makeServer();
        const mockOblecto = {
            streamSessionController: {
                sessionExists: () => false,
                sessions: {},
                newSession: (_file: any, options: any) => {
                    createdOptions = options;
                    return {
                        sessionId: 'session-456',
                        videoCodec: 'h264',
                        audioCodec: 'aac',
                        file: _file,
                        selectedAudioStreamIndex: options.audioStreamIndex ?? null,
                        selectedSubtitleStreamIndex: options.subtitleStreamIndex ?? null,
                        subtitleMode: options.subtitleMode ?? 'auto'
                    };
                }
            }
        };

        streamingRoutes(server as any, mockOblecto as any);

        const handler = server.handlers.get('GET /session/create/:id');
        const res = makeRes();
        const req = {
            params: { id: '1' },
            combined_params: {
                type: 'hls',
                subtitleStreamIndex: '-1',
                subtitleMode: 'auto'
            }
        };

        await handler(req, res, (error: any) => {
            throw error;
        });

        assert.equal(res.statusCode, 200);
        assert.equal(createdOptions.subtitleStreamIndex, null);
        assert.equal(res.body.selectedTracks.subtitleStreamIndex, null);
    });

    it('returns bad request when track index is invalid', async () => {
        const server = makeServer();
        const mockOblecto = {
            streamSessionController: {
                sessionExists: () => false,
                sessions: {},
                newSession: () => {
                    throw new Error('should not be called');
                }
            }
        };

        streamingRoutes(server as any, mockOblecto as any);

        const handler = server.handlers.get('GET /session/create/:id');
        const res = makeRes();
        const req = {
            params: { id: '1' },
            combined_params: {
                type: 'hls',
                audioStreamIndex: '999',
                subtitleMode: 'auto'
            }
        };

        await handler(req, res, (error: any) => {
            res.status(error.statusCode || 500).send({ message: error.message });
        });

        assert.equal(res.statusCode, 400);
        assert.match(String(res.body.message), /audioStreamIndex/i);
    });

    it('returns bad request when track index is not an integer', async () => {
        const server = makeServer();
        const mockOblecto = {
            streamSessionController: {
                sessionExists: () => false,
                sessions: {},
                newSession: () => {
                    throw new Error('should not be called');
                }
            }
        };

        streamingRoutes(server as any, mockOblecto as any);

        const handler = server.handlers.get('GET /session/create/:id');
        const res = makeRes();
        const req = {
            params: { id: '1' },
            combined_params: {
                type: 'hls',
                audioStreamIndex: '2abc',
                subtitleMode: 'auto'
            }
        };

        await handler(req, res, (error: any) => {
            res.status(error.statusCode || 500).send({ message: error.message });
        });

        assert.equal(res.statusCode, 400);
        assert.match(String(res.body.message), /audioStreamIndex/i);
    });

    it('returns bad request when subtitleMode is invalid', async () => {
        const server = makeServer();
        const mockOblecto = {
            streamSessionController: {
                sessionExists: () => false,
                sessions: {},
                newSession: () => {
                    throw new Error('should not be called');
                }
            }
        };

        streamingRoutes(server as any, mockOblecto as any);

        const handler = server.handlers.get('GET /session/create/:id');
        const res = makeRes();
        const req = {
            params: { id: '1' },
            combined_params: {
                type: 'hls',
                subtitleMode: 'maybe'
            }
        };

        await handler(req, res, (error: any) => {
            res.status(error.statusCode || 500).send({ message: error.message });
        });

        assert.equal(res.statusCode, 400);
        assert.match(String(res.body.message), /subtitleMode/i);
    });
});
