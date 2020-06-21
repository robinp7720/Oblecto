import ffmpeg from '../../ffmpeg';

export default class {
    static async TranscodeStreamer(oblecto, video, offset, req, res) {

        ffmpeg(video.path)
        //.native()
            .format('mp4')
            .videoCodec('libx264')
            .audioCodec('aac')
            .seekInput(offset)
            .inputOptions([
                '-noaccurate_seek'
            ])
            .outputOptions([
                '-movflags', 'empty_moov',
                '-copyts'
            ])
            .on('start', (cmd) => {
                console.log('--- ffmpeg start process ---');
                console.log(`cmd: ${cmd}`);
            })
            .on('end', () => {
                console.log('--- end processing ---');
            })
            .on('error', (err) => {
                console.log('--- ffmpeg meets error ---');
                console.log(err);
            })
            .pipe(res, {end: true});

    }
}
