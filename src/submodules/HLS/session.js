import uuid from 'node-uuid';
import databases from "../database";
import segmentExtractor from "./segmentExtractor";

export  default class {
    constructor(fileId) {
        this.sessionId = uuid.v4();
        this.fileId = fileId;
        this.segments = [];

        this.init();
    }

    async init() {
        this.file = await databases.file.findById(this.fileId);
        this.start();
    }

    start() {
        this.segmentExtractor = new segmentExtractor(this.file);
        this.segmentExtractor.on('segment', this.addSegment.bind(this));
        this.segmentExtractor.starKeyFrameExtractor()
    }

    addSegment(start, end) {
        this.segments.push({
            start,
            end
        });
    }


    get playlist() {
        let playlist = "#EXTM3U\r\n";
        playlist += "#EXT-X-PLAYLIST-TYPE:EVENT\r\n";
        playlist += "#EXT-X-TARGETDURATION:6\r\n";
        playlist += "#EXT-X-VERSION:4\r\n";
        playlist += "#EXT-X-ALLOW-CACHE:NO\r\n";
        //playlist += "#EXT-X-DISCONTINUITY\r\n";
        playlist += "#EXT-X-MEDIA-SEQUENCE:0\r\n";

        for (let segment = 0; segment < this.segments.length; segment++) {
            playlist += `#EXTINF:${this.segments[segment].end - this.segments[segment].start},\r\n`;
            playlist += `/HLS/${this.fileId}/segment/${this.segments[segment].start}/${this.segments[segment].end}/\r\n`;
        }


        return playlist;
    }

}