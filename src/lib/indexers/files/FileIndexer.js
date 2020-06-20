import Path from 'path';
import databases from '../../../submodules/database';
import FileExistsError from '../../errors/FileExistsError';
import VideoAnalysisError from '../../errors/VideoAnalysisError';
import ffprobe from '../../../submodules/ffprobe';

export default class FileIndexer {
    static async getPrimaryVideoStream(metadata) {
        let streams = metadata.streams;
        let primaryStream = {duration: 0};

        for (const stream of streams) {
            if (stream.duration || 1 >= primaryStream.duration) {
                if (stream['codec_type'] !=='video')
                    continue;

                primaryStream = stream;
            }
        }

        return primaryStream;
    }

    static async getPrimaryAudioStream(metadata) {
        let streams = metadata.streams;
        let primaryStream = {duration: 0};

        for (const stream of streams) {
            if (stream.duration || 1 >= primaryStream.duration) {
                if (stream['codec_type'] !=='audio')
                    continue;

                primaryStream = stream;
            }
        }

        return primaryStream;
    }

    static async indexVideoFile(videoPath) {
        let parsedPath = Path.parse(videoPath);
        let extension = parsedPath.ext.replace('.', '').toLocaleLowerCase();

        let [file, fileInserted] = await databases.file.findOrCreate({
            where: {path: videoPath},
            defaults: {
                host: 'local',
                name: parsedPath.name,
                directory: parsedPath.dir,
                extension: parsedPath.ext,
            }
        });

        let metadata = {};

        try {
            metadata = await ffprobe(videoPath);
        } catch (e) {
            throw new VideoAnalysisError();
        }

        let primaryVideoStream = await this.getPrimaryVideoStream(metadata);
        let primaryAudioStream = await this.getPrimaryAudioStream(metadata);

        let duration = metadata.format.duration;

        if (isNaN(duration)) {
            throw new VideoAnalysisError();
        }

        if (!primaryVideoStream['codec_name']) {
            console.log(metadata);
        }

        await file.update({
            duration,
            host: 'local',
            container: metadata.format['format_name'],
            videoCodec: primaryVideoStream['codec_name'],
            audioCodec: primaryAudioStream['codec_name']
        });

        if (!fileInserted) {
            throw new FileExistsError();
        }

        return file;
    }
}
