import FederationMediaClient from '../../lib/federation/client/FederationMediaClient';

export default class FederationStreamer {
    static async streamFile(video, offset, req, res) {

        let federationClient = new FederationMediaClient(video.host);

        await federationClient.connect();

        await federationClient.setStreamDestination(res);
        await federationClient.setStreamOffset(offset);
        await federationClient.startStreamFile(video.path);



    }
}
