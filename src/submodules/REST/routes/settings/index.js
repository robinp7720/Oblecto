import maintenance from './maintenance';
import sources from './sources';
import misc from './misc';
import remoteImport from './remoteImport';

export default (server, oblecto) => {
    maintenance(server, oblecto);
    sources(server, oblecto);
    misc(server, oblecto);
    remoteImport(server, oblecto);
};
