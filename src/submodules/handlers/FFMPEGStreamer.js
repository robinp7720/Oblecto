import DvdStreamer from './FFMPEGHandlers/DvdStreamer';
import RemuxStreamer from "./FFMPEGHandlers/RemuxStreamer";
import TranscodeStreamer from './FFMPEGHandlers/TranscodeStreamer';
import config from '../../config';

function requireTranscode(video) {
    if (config.transcoding.transcodeEverything) return true;
    if (!config.transcoding.doRealTimeTranscode) return false;

    if (video.extension === 'avi') {
        return true;
    }

    if (video.videoCodec === 'hevc') {
        return true;
    }

    return false;
}

export default class {
    static async streamFile (video, offset, req, res) {
        if (video.extension === 'iso') {
            await DvdStreamer.DvdSteamer(video, offset, req, res);
            return;
        }

        if (requireTranscode(video)) {
            await TranscodeStreamer.TranscodeStreamer(video, offset, req, res);
            return;
        }

        await RemuxStreamer.RemuxSteamer(video, offset, req, res);

    }
}
