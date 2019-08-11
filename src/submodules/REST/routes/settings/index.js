import maintenance from './maintenance';
import sources from './sources';

export default (server) => {
    maintenance(server);
    sources(server);
};