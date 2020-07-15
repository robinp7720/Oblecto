import ffmpeg from '../../ffmpeg';

export default class {
    static async RemuxSteamer(oblecto, video, offset, req, res) {

        let process = ffmpeg(video.path)
        //.native()
            .format('mp4')
            .videoCodec('copy')
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
            });

        process.on('error', (err) => {
            console.log('--- ffmpeg meets error ---');
            console.log(err);
            process.kill();
        });

        process.pipe(res, {end: true});

    }
}
