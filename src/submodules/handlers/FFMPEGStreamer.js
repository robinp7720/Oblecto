import mimeTypes from 'mime-types';
import fs from 'fs';
import ffmpeg from "../ffmpeg";

export default class {
    static streamFile (videoPath, offset, req, res) {

        res.writeHead(200, {
            'Content-Type': 'video/mp4'
        });


        // Chrome has video audio desync issues when using input seeking on ffmpeg
        // as it doesn't respect the presentation time stamp and aligns the streams from begining of both streams
        // instead of by time stamp. Using output seeking for the last section of the video seams to solve this
        // desyncing issue.

        // TODO: Retrieve time between keyframes and use output seeking to seek from previous keyframe to current time

        let inputSeek = Math.floor(offset) - 1;
        let outputSeek = offset - inputSeek;

        ffmpeg(videoPath)
        //.native()
            .format('mp4')
            .videoCodec('copy')
            .audioCodec('aac')
            .seekInput(inputSeek)
            .seek(outputSeek)
            .outputOptions([
                '-movflags', 'empty_moov',
            ])
            .on('start', (cmd)=>{
                console.log('--- ffmpeg start process ---');
                console.log(`cmd: ${cmd}`);
            })
            .on('end',()=>{
                console.log('--- end processing ---');
            })
            .on('error', (err)=>{
                console.log('--- ffmpeg meets error ---');
                console.log(err);
            })
            .pipe(res, { end:true });

    }
}