import { File } from '../../../models/file';

import Path from 'path';
import FileExistsError from '../../errors/FileExistsError';
import ffprobe from '../../../submodules/ffprobe';
import { Stream } from '../../../models/stream';
import Oblecto from '../../oblecto';

export default class FileIndexer {
    /**
     *
     * @param {Oblecto} oblecto - Oblecto server instance
     */
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.oblecto.queue.registerJob('indexFileStreams', this.indexVideoFileStreams);
    }

    async indexVideoFile(videoPath) {
        let parsedPath = Path.parse(videoPath);

        let [file, fileInserted] = await File.findOrCreate({
            where: { path: videoPath },
            defaults: {
                host: 'local',
                name: parsedPath.name,
                directory: parsedPath.dir,
                extension: parsedPath.ext.replace('.', '')
            }
        });

        if (!fileInserted) {
            throw new FileExistsError(`${videoPath} is already in the file database`);
        }

        await this.oblecto.fileUpdateCollector.collectFile(file);

        return file;
    }

    async indexVideoFileStreams(file) {
        let metadata = await ffprobe(file.path);

        for (let stream_base of metadata.streams) {
            for (let i in stream_base) {
                if (stream_base[i] === 'N/A' || stream_base[i] === 'unknown') {
                    stream_base[i] = null;
                }
            }

            let stream = {
                FileId: file.id,
                stream_id: stream_base.id,
                disposition_default: stream_base.disposition.default,
                disposition_dub: stream_base.disposition.dub,
                disposition_original: stream_base.disposition.original,
                disposition_comment: stream_base.disposition.comment,
                disposition_lyrics: stream_base.disposition.lyrics,
                disposition_karaoke: stream_base.disposition.karaoke,
                disposition_forced: stream_base.disposition.forced,
                disposition_hearing_impaired: stream_base.disposition.hearing_impaired,
                disposition_clean_effects: stream_base.disposition.clean_effects,
                disposition_attached_pic: stream_base.disposition.attached_pic,
                disposition_timed_thumbnails: stream_base.disposition.timed_thumbnails,
                ...stream_base
            };

            if (stream_base.tags) {
                stream['tags_language'] = stream_base.tags.language;
                stream['tags_title'] = stream_base.tags.title;

                delete stream.tags;
            }

            delete stream.id;
            delete stream.disposition;

            delete stream.codec_long_name;
            delete stream.codec_tag;

            await Stream.findOrCreate({
                where: {
                    FileId: stream.FileId,
                    stream_id: stream.stream_id,
                    index: stream.index,
                    codec_name: stream.codec_name,
                },
                defaults: stream
            });
        }
    }
}
