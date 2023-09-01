/**
 * @param {*} server
 * @param {EmbyEmulation} embyEmulation
 */
export default (server, embyEmulation) => {
    server.get('/displaypreferences/usersettings', async (req, res, next) => {
        res.send({
            //'Id': '3ce5b65de116d73165d1efc4a30ec35c',
            'RememberIndexing': false,
            'PrimaryImageHeight': 250,
            'PrimaryImageWidth': 250,
            'ScrollDirection': 'Horizontal',
            'ShowBackdrop': true,
            'RememberSorting': false,
            'SortOrder': 'Ascending',
            'ShowSidebar': false,
            'Client': 'emby'
        });

        next();
    });
};
