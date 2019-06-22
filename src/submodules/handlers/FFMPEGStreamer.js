import mimeTypes from 'mime-types';
import fs from 'fs';
import ffmpeg from "../ffmpeg";

export default class {
    static streamFile (videoPath, offset, req, res) {

        res.writeHead(200, {
            'Content-Type': 'video/mp4'
        });

        ffmpeg(videoPath)
        //.native()
            .format('mp4')
            .videoCodec('copy')
            .audioCodec('aac')
            .seekInput(offset)
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