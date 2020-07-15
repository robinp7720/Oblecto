import mdns from 'mdns';

export default {
    ad: undefined,
    start: function (port) {
        this.ad = mdns.createAdvertisement(mdns.tcp('oblecto'), port);
        this.ad.start();
    }
};
