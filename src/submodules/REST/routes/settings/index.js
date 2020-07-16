import maintenance from './maintenance';
import sources from './sources';

export default (server, oblecto) => {
    maintenance(server, oblecto);
    sources(server, oblecto);
};
