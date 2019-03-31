import {spawn} from "child_process";
import config from "../../config";
import events from "events";

export  default class segmentExtractor {
    constructor(file) {
        this.file = file;

        this.eventEmitter = new events.EventEmitter();
    }

    starKeyFrameExtractor() {
        this.extractor = spawn(config.ffmpeg.pathFFprobe, [
            this.file.path,
            '-show_frames',
            '-select_streams', 'v'
        ]);

        let lastTime = 0;
        let lastNonKeyTime = 0;
        let secondlastNonKeyTime = 0;

        this.extractor.stdout.on('data', (data) => {
            //let keyframe = data.toString().match(/\[FRAME\][\r\n|\r|\n]pkt_pts_time=(.+)[\r\n|\r|\n]pict_type=(.+)[\r\n|\r|\n]\[SIDE_DATA\][\r\n|\r|\n]side_data_type=(.+)[\r\n|\r|\n]\[\/SIDE_DATA\][\r\n|\r|\n]\[\/FRAME\]/)
            let input = data.toString();

            let keyframe = input.match(/key_frame=(.+)/)[1];
            let pkt_pts_time = input.match(/pkt_pts_time=(.+)/)[1];

            if (keyframe == 0) {
                secondlastNonKeyTime = lastNonKeyTime;
                lastNonKeyTime = pkt_pts_time;
                return
            }

            if (pkt_pts_time - lastTime < 5) {
                return
            }

            this.eventEmitter.emit('segment', lastTime , pkt_pts_time);


            lastTime = pkt_pts_time;
        });

        this.extractor.stdout.on('close', () => {
            this.eventEmitter.emit('end');
        });

        this.extractor.on('exit', (code, signal) => {
            this.eventEmitter.emit('end');
        });

        this.extractor.stderr.on('data', (data) => {
            this.eventEmitter.emit('end');
        });

        this.extractor.stderr.on('close', () => {
            this.eventEmitter.emit('end');
        });

    }

    on(event, callback) {
        this.eventEmitter.on(event, callback)
    }
}