// import the module
var mdns = require('mdns');

module.exports = {
    ad: undefined,
    start: function (port) {
        this.ad = mdns.createAdvertisement(mdns.tcp('oblecto'), port);
        this.ad.start();
    }
};