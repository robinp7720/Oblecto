import StreamSession from '../StreamSession';
import ffmpeg from '../../../submodules/ffmpeg';
import Stream from 'stream';
import FederationMediaClient from '../../federation/client/FederationMediaClient';

export default class RecodeFederationStreamSession extends StreamSession {
    constructor(file, options, oblecto) {
        super(file, options, oblecto);

        this.inputStream = new Stream.PassThrough;
        this.outputStream = new Stream.PassThrough;

        this.outputStream.on('close', () => {
            this.emit('close');
        });
    }

    async addDestination(destination) {
        this.destinations.push(destination);
        this.outputStream.pipe(destination.stream);

        let _this = this;

        destination.stream
            .on('error', (err) => {
                console.log(err);
            })
            .on('close', function () {
                for (let i in _this.destinations) {
                    if (_this.destinations[i].stream === this) {
                        _this.destinations.splice(i, 1);
                    }
                }

                if (_this.destinations.length === 0) {
                    _this.outputStream.destroy();
                }
            });
    }

    async startStream() {
        await super.startStream();

        if (this.started) return;

        this.started = true;

        this.process = ffmpeg(await this.getFederationStream())
            //.native()
            .format(this.format)
            .videoCodec(this.getFfmpegVideoCodec())
            .audioCodec(this.audioCodec)
            .inputOptions([
                '-noaccurate_seek',
            ])
            .outputOptions([
                '-movflags', 'empty_moov',
                '-copyts',
            ])
            .on('start', (cmd) => {

            })
            .on('end', () => {
                this.process.kill();
            });

        this.process.on('error', (err) => {
            this.process.kill();
        });

        this.process.pipe(this.outputStream, {end: true});
    }

    async getFederationStream() {
        this.federationClient = new FederationMediaClient(this.oblecto, this.file.host);

        await this.federationClient.connect();

        await this.federationClient.setStreamDestination(this.inputStream);
        await this.federationClient.setStreamOffset(this.offset);
        await this.federationClient.startStreamFile(this.file.path);
    }

    getFfmpegVideoCodec() {
        let codec = this.videoCodec;

        let codecs = {
            'h264': 'libx264'
        };

        if (codecs[codec]) codec = codecs[codec];

        return codec;
    }

}
