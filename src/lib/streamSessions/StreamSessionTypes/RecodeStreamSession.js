import StreamSession from '../StreamSession';
import ffmpeg from '../../../submodules/ffmpeg';
import logger from '../../../submodules/logger';

export default class RecodeStreamSession extends StreamSession {
    constructor(file, options, oblecto) {
        super(file, options, oblecto);

        if (this.videoCodec === this.file.videoCodec || this.file.videoCodec in this.targetVideoCodecs) {
            this.videoCodec = 'copy';
        }

        if (this.audioCodec === this.file.audioCodec || this.file.audioCodec in this.targetAudioCodecs) {
            this.audioCodec = 'copy';
        }
    }

    async addDestination(destination) {
        await super.addDestination(destination);
    }

    async startStream() {
        await super.startStream();

        if (this.started) return;

        this.started = true;

        let inputOptions = [
            '-noaccurate_seek',
        ];

        let outputOptions = [
            '-movflags empty_moov',
            '-copyts',
        ];

        if (this.oblecto.config.transcoding.hardwareAcceleration) {
            inputOptions.push('-hwaccel ' + this.oblecto.config.transcoding.hardwareAccelerator);

            // The Nvidia NVENC encoder doesn't support 10 bit encoding, so we need to force 8 bit
            // if the cuda accelerator has been selected

            // TODO: Fix washed out colors for some 10 bit video streams when using the NVENC encoder
            // Depending on the input color range, this may result in washed out colors since the color range is kept
            // but considered to be a full range color space even if the input range is limited.

            if (this.oblecto.config.transcoding.hardwareAccelerator === 'cuda') {
                outputOptions.push('-pix_fmt yuv420p');
            }
        }

        let streams = await this.file.getStreams();

        let videoStreamIndex = 0;
        let audioStreams = [];

        for (let stream of streams) {
            if (stream.codec_type === 'video') videoStreamIndex = stream.index;
            if (stream.codec_type === 'audio') audioStreams.push(stream);
        }

        outputOptions.push(`-map 0:${videoStreamIndex}`);

        let audioStreamSelected = false;

        for (let stream of audioStreams) {
            if (stream.tags_language === 'eng'){
                outputOptions.push(`-map 0:${stream.index}`);
                audioStreamSelected = true;
            }
        }

        if (!audioStreamSelected) {
            outputOptions.push(`-map 0:${audioStreams[0].index}`);
        }


        this.process = ffmpeg(this.file.path)
            .format(this.format)
            .videoCodec(this.getFfmpegVideoCodec())
            .audioCodec(this.audioCodec)
            .seekInput(this.offset)
            .inputOptions(inputOptions)
            .outputOptions(outputOptions)
            .on('start', (cmd) => {
                logger.log('INFO', this.sessionId, cmd);
            });

        this.process.on('error', (err) => {
            if (err.message !== 'ffmpeg was killed with signal SIGKILL') logger.log('ERROR', this.sessionId, err);
        });

        this.process.pipe(this.outputStream, {end: true});
    }
}
