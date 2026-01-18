import mdns from 'mdns';

export default {
    ad: undefined as any,
    start: function (port: number) {
        this.ad = mdns.createAdvertisement(mdns.tcp('oblecto'), port);
        this.ad.start();
    }
};
