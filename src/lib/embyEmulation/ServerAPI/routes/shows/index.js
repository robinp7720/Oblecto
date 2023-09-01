/**
 * @param {*} server
 * @param {EmbyEmulation} embyEmulation
 */
export default (server, embyEmulation) => {
    server.get('/shows/nextup', async (req, res, next) => {
        res.send({'Items':[],'TotalRecordCount':0,'StartIndex':0});
        next();
    });

    server.get('/shows/:seriesid/episodes', async (req, res, next) => {
        res.send({'Items':[],'TotalRecordCount':0,'StartIndex':0});
        next();
    });
};
