import StreamSession from '../StreamSession';
import ffmpeg from '../../../submodules/ffmpeg';
import logger from '../../../submodules/logger';

/**
 * @typedef {import('../../oblecto').default} Oblecto
 * @typedef {import("../../../models/file").File} File
 */

/**
 * Streamer session to allow for playback on devices which don't support the native file format.
 * This streamer also allows for sever side seeking
 */
export default class RecodeStreamSession extends StreamSession {
    /**
     * @param {File} file - File to be streamed
     * @param {any} options - Options for Media streamer
     * @param {Oblecto} oblecto - Oblecto server instance
     */
    constructor(file, options, oblecto) {
        super(file, options, oblecto);

        // LanguageCode is the ISO 639-2 code for the desired language
        this.targetLanguageCode = oblecto.config.streaming.defaultTargetLanguageCode;

        // If only the container format needs to be changed, there is no need to recode the video and audio streams
        // Therefore, copy streams should be used if the target codecs are the same as the source codecs

        // Copy the video stream if the target format is the same
        if (this.targetVideoCodecs.includes(this.file.videoCodec)) {
            this.videoCodec = 'copy';
        }

        // Copy the audio stream if the target format is the same
        if (this.targetAudioCodecs.includes(this.file.audioCodec)) {
            this.audioCodec = 'copy';
        }
    }

    async startStream() {
        await super.startStream();

        if (this.started) return;

        this.started = true;

        let inputOptions = ['-noaccurate_seek',];

        let outputOptions = [
            '-movflags empty_moov',
            '-copyts',
            '-preset ultrafast',
            '-tune zerolatency'
        ];

        if (this.oblecto.config.transcoding.hardwareAcceleration) {
            inputOptions.push('-hwaccel ' + this.oblecto.config.transcoding.hardwareAccelerator);

            // The Nvidia NVENC encoder doesn't support 10 bit encoding, so we need to force 8 bit
            // if the cuda accelerator has been selected

            // TODO: Fix washed out colors for some 10 bit video streams when using the NVENC encoder
            //       Depending on the input color range, this may result in washed out colors since the
            //       color range is kept but considered to be a full range color space even if the input
            //       range is limited.

            if (this.oblecto.config.transcoding.hardwareAccelerator === 'cuda') {
                outputOptions.push('-pix_fmt yuv420p');
            }

            if (this.oblecto.config.transcoding.hardwareAccelerator === 'vaapi') {
                inputOptions.push('-hwaccel_output_format vaapi');
            }
        }

        let streams = await this.file.getStreams();

        let audioStreams = [];
        let videoStreams = [];

        for (let stream of streams) {
            if (stream.codec_type === 'video') videoStreams.push(stream);
            if (stream.codec_type === 'audio') audioStreams.push(stream);
        }

        // Define default streams. We don't want to end up with a video without any audio or video streams
        let selectedAudioStream = audioStreams?.[0]?.index;
        let selectedVideoStream = videoStreams?.[0]?.index;

        // Find a video stream with the desired language code
        // TODO: Some languages may be identified by multiple language codes
        //       EG: French sometimes uses both "Fra" and "Fre"

        // TODO: Allow direct selection of audio stream as well as through language code
        for (let stream of audioStreams) {
            if (stream.tags_language === this.targetLanguageCode && stream.index !== undefined){
                selectedAudioStream = stream.index;

                // When we have found a matching stream, we don't want to keep looking for others
                // Some media files may have multiple streams with the same language code.
                // Usually this is because of commentary or similar tracks.
                // These tracks are usually the end
                // TODO: Filter out commentary tracks separately
                break;
            }
        }

        if (!(selectedVideoStream === undefined || selectedAudioStream === undefined)) {
            outputOptions.push(`-map 0:${selectedAudioStream}`);
            outputOptions.push(`-map 0:${selectedVideoStream}`);
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
            logger.log('ERROR', this.sessionId, err);
        });

        // Pipe the transcoded output to the session output stream instead of
        // directly to the first destination. This prevents the ffmpeg process
        // from being terminated when a client disconnects prematurely.
        this.process.pipe(this.outputStream, { end: true });
    }

    outputPause() {
        super.outputPause();

        if (this.process) this.process.kill('SIGSTOP');
    }

    outputResume() {
        super.outputResume();

        if (this.process) this.process.kill('SIGCONT');
    }
}
