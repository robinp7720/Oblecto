import mdns from 'mdns';

interface Advertisement {
    start: () => void;
    stop: () => void;
}

export default {
    ad: undefined as Advertisement | undefined,
    start: function (port: number) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        this.ad = mdns.createAdvertisement(mdns.tcp('oblecto'), port);
        this.ad?.start();
    }
};
