import system from './system';
import users from './users';
import sessions from './sessions';
import displaypreferences from './displaypreferences';

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
};
