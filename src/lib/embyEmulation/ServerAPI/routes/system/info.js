export default (server, embyEmulation) => {
    server.get('/system/info/public', async (req, res, next) => {
        res.send({
            'LocalAddress': 'http://oblecto:8096',
            'ServerName': 'jellyfin',
            'Version': '10.6.4',
            'ProductName': 'Jellyfin Server',
            'OperatingSystem': 'Linux',
            'Id': embyEmulation.serverId
        });

        next();
    });
};
