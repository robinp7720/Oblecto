export default (server, embyEmulation) => {
    server.get('/branding/configuration', async (req, res) => {
        res.send({
            LoginDisclaimer: 'This is an Oblecto Media server',
            CustomCss: ''
        });
    });

    server.get('/branding/css', async (req, res) => {
        res.send();
    });

    server.get('/branding/splashscreen', async (req, res) => {
        res.send('');
    });
};
