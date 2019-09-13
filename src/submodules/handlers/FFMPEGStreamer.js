import mimeTypes from 'mime-types';
import fs from 'fs';
import ffmpeg from '../ffmpeg';
import ffprobe from '../ffprobe';
import DvdStreamer from './FFMPEGHandlers/DvdStreamer';
import RemuxStreamer from "./FFMPEGHandlers/RemuxStreamer";

export default class {
    static async streamFile (video, offset, req, res) {

        res.writeHead(200, {
            'Content-Type': 'video/mp4'
        });

        if (video.extension === 'iso') {
            DvdStreamer.DvdSteamer(video, offset, req, res);
        } else {
            RemuxStreamer.RemuxSteamer(video, offset, req, res);
        }

    }
}
