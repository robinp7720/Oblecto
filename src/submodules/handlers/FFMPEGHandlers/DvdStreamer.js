import mimeTypes from 'mime-types';
import fs from 'fs';
import ffmpeg from '../../ffmpeg';
import ffprobe from '../../ffprobe';

export default class {
    static async DvdSteamer (video, offset, req, res) {

        let probe = await ffprobe(video.path);
        let streams = probe.streams;

        console.log(probe);

        let mainFeatureId = streams[0].index;
        let mainAudioId = streams[0].index;

        for (const stream of streams){
            if (stream.profile === 'Main') {
                mainFeatureId = stream.index;
                break;
            }
        }

        for (const stream of streams){
            if (stream.codec_type === 'audio') {
                mainAudioId = stream.index;
                break;
            }
        }

        ffmpeg(video.path)
        //.native()
            .format('mp4')
            .videoCodec('libx264')
            .audioCodec('aac')
            .seekInput(offset)
            .outputOptions([
                '-movflags', 'empty_moov',
                `-map 0:${mainFeatureId}`,
                `-map 0:${mainAudioId}`
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
