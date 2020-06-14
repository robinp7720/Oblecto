import DvdStreamer from './FFMPEGHandlers/DvdStreamer';
import RemuxStreamer from "./FFMPEGHandlers/RemuxStreamer";
import TranscodeStreamer from './FFMPEGHandlers/TranscodeStreamer';

function requireTranscode(video) {
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

        res.writeHead(200, {
            'Content-Type': 'video/mp4'
        });

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
