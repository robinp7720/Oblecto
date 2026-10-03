import { createHash } from 'node:crypto';
import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';
import { File } from '../../../../../models/file.js';
import { Movie } from '../../../../../models/movie.js';
import { Episode } from '../../../../../models/episode.js';
import { formatFileId, parseFileId, parseId } from '../../../helpers.js';
import { getRequestList, getRequestValue } from '../../requestUtils.js';
import type { EmbyRequest } from '../../index.js';
import { sendFile } from '../../../../playback/http.js';

const SEGMENT_TYPES: Record<string, string> = {
    intro: 'Intro', credits: 'Outro', recap: 'Recap', preview: 'Preview'
};

/**
 * The file an item id names: a movie or episode's own (the one `MediaSourceId` picks, else the
 * first), or a media source id, which is a file id.
 */
async function resolveFile(itemId: string, mediaSourceId?: string): Promise<File | null> {
    const { id, type } = parseId(itemId);

    if (type === 'movie' || type === 'episode') {
        const item = type === 'episode' ? await Episode.findByPk(id, { include: [File] }) : await Movie.findByPk(id, { include: [File] });
        const files = (item?.get('Files') ?? []) as File[];
        const wanted = mediaSourceId ? parseFileId(mediaSourceId) : null;

        return (wanted === null ? files[0] : files.find(file => file.id === Number(wanted))) ?? null;
    }

    const fileId = parseFileId(itemId);

    return typeof fileId === 'number' && Number.isSafeInteger(fileId) ? File.findByPk(fileId) : null;
}

export default (server: Application, embyEmulation: EmbyEmulation): void => {
    // Audio
    server.get('/audio/:itemid/hls/:segmentid/stream.aac', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/hls/:segmentid/stream.mp3', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/lyrics', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/remotesearch/lyrics', (_req: Request, res: Response) => { res.send([]); });
    server.get('/audio/:itemid/remotesearch/lyrics/:lyricid', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/universal', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/stream', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/stream.:container', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/hls1/:playlistid/:segmentid.:container', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/main.m3u8', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/master.m3u8', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });

    // Videos
    server.get('/videos/activeencodings', (_req: Request, res: Response) => { res.send([]); });
    server.get('/videos/mergeversions', (_req: Request, res: Response) => { res.status(204).send(); });
    server.get('/videos/:itemid/additionalparts', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });
    server.get('/videos/:itemid/alternatesources', (_req: Request, res: Response) => { res.send([]); });
    server.get('/videos/:itemid/subtitles', (_req: Request, res: Response) => { res.send({}); });
    server.get('/videos/:itemid/subtitles/:index', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    // Seek thumbnails: an HLS image playlist of the sheets, and the sheets themselves
    server.get('/videos/:itemid/trickplay/:width/tiles.m3u8', async (req: EmbyRequest, res: Response) => {
        const mediaSourceId = getRequestValue(req, 'MediaSourceId');
        const file = await resolveFile(String(req.params.itemid), mediaSourceId);
        const info = file?.trickplay;

        if (!file || !info || String(info.width) !== String(req.params.width)) {
            res.status(404).send('Not Found');
            return;
        }

        const perSheet = info.tileWidth * info.tileHeight;
        const apiKey = getRequestValue(req, 'ApiKey', 'api_key');
        const query = new URLSearchParams({ MediaSourceId: formatFileId(file.id), ...(apiKey ? { ApiKey: apiKey } : {}) }).toString();
        const lines = [
            '#EXTM3U',
            `#EXT-X-TARGETDURATION:${perSheet * info.interval}`,
            '#EXT-X-VERSION:7',
            '#EXT-X-MEDIA-SEQUENCE:1',
            '#EXT-X-PLAYLIST-TYPE:VOD',
            '#EXT-X-IMAGES-ONLY'
        ];

        for (let sheet = 0; sheet < info.sheets; sheet++) {
            const thumbnails = Math.min(perSheet, info.count - sheet * perSheet);

            lines.push(
                `#EXT-X-TILES:RESOLUTION=${info.width}x${info.height},LAYOUT=${info.tileWidth}x${info.tileHeight},DURATION=${info.interval}`,
                `#EXTINF:${thumbnails * info.interval},`,
                `${sheet}.jpg?${query}`
            );
        }

        lines.push('#EXT-X-ENDLIST', '');
        res.type('application/vnd.apple.mpegurl').send(lines.join('\n'));
    });
    server.get('/videos/:itemid/trickplay/:width/:index.jpg', async (req: EmbyRequest, res: Response) => {
        const file = await resolveFile(String(req.params.itemid), getRequestValue(req, 'MediaSourceId'));
        const sheet = file && String(file.trickplay?.width) === String(req.params.width)
            ? embyEmulation.oblecto.mediaAnalyser?.trickplaySheet(file, Number(req.params.index))
            : null;

        if (!sheet) {
            res.status(404).send('Not Found');
            return;
        }

        res.setHeader('Cache-Control', 'private, max-age=86400');
        await sendFile(req, res, sheet, 'image/jpeg');
    });
    server.get('/videos/:itemid/:mediasourceid/subtitles/:index/subtitles.m3u8', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/videos/:videoid/:mediasourceid/attachments/:index', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });

    // Complex video routes with many params (simplified stubs)
    server.get('/videos/:routeitemid/:routemediasourceid/subtitles/:routeindex/:routestartpositionticks/stream.:routeformat', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/videos/:routeitemid/:routemediasourceid/subtitles/:routeindex/stream.:routeformat', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });

    // Intros, credits, recaps and previews. jellyfin-web asks with the media source id.
    server.get('/mediasegments/:itemid', async (req: EmbyRequest, res: Response) => {
        const itemId = String(req.params.itemid);
        const file = await resolveFile(itemId);
        const wanted = getRequestList(req, 'includeSegmentTypes').map(type => type.toLowerCase());
        const items = (file?.segments ?? [])
            .map(segment => ({ segment, type: SEGMENT_TYPES[segment.type] }))
            .filter(({ type }) => type && (!wanted.length || wanted.includes(type.toLowerCase())))
            .map(({ segment, type }) => ({
                'Id': createHash('md5').update(`${file!.id}:${segment.type}:${segment.start}`).digest('hex'),
                'ItemId': itemId,
                'Type': type,
                'StartTicks': Math.round(segment.start * 10000000),
                'EndTicks': Math.round(segment.end * 10000000)
            }));

        res.send({
            Items: items, TotalRecordCount: items.length, StartIndex: 0
        });
    });
};
