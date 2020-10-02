import maintenance from './maintenance';
import sources from './sources';
import misc from './misc';

export default (server, oblecto) => {
    maintenance(server, oblecto);
    sources(server, oblecto);
    misc(server, oblecto);
};
