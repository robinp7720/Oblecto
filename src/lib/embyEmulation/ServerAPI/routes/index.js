import system from './system';
import users from './users';
import sessions from './sessions';
import displaypreferences from './displaypreferences';
import branding from './branding';
import shows from './shows';
import items from './items';
import videos from './videos';

/**
 *
 * @param server
 * @param {EmbyEmulation} embyEmulation
 */
export default (server, embyEmulation) => {
    system(server, embyEmulation);
    users(server, embyEmulation);
    sessions(server, embyEmulation);
    displaypreferences(server, embyEmulation);
    branding(server, embyEmulation);
    shows(server, embyEmulation);
    items(server, embyEmulation);
    videos(server, embyEmulation);
};
