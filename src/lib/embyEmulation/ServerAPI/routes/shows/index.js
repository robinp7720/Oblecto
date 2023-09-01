/**
 * @param {*} server
 * @param {EmbyEmulation} embyEmulation
 */
export default (server, embyEmulation) => {
    server.get('/shows/nextup', async (req, res) => {
        res.send({
            'Items':[],'TotalRecordCount':0,'StartIndex':0
        });
    });

    server.get('/shows/:seriesid/episodes', async (req, res) => {
        res.send({
            'Items':[],'TotalRecordCount':0,'StartIndex':0
        });
    });
};
