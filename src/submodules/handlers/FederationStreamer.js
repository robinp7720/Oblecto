import FederationMediaClient from '../../lib/federation/client/FederationMediaClient';

export default class FederationStreamer {
    static streamFile(video, offset, req, res) {

        let federationClient = new FederationMediaClient(video.host);
        federationClient.setStreamDestination(res);
        federationClient.setStreamFile(video.path);
        federationClient.setStreamOffset(offset);
        federationClient.startStream();

    }
}
