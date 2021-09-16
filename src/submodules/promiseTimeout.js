import WarnExtendableError from '../lib/errors/WarnExtendableError';

/**
 * Add a timeout to a promise
 *
 * @param {Promise} promise - Promise to which the timeout should be added
 * @param {number} time - Timeout milliseconds
 */
export default function (promise, time = 10000) {
    return new Promise(function(resolve, reject) {
        let timedout = false;
        let timeout = setTimeout(() => {
            timedout = true;

            reject(new WarnExtendableError('A promise has timed out'));
        }, time);

        promise.then(response => {
            if (timedout) return;

            clearTimeout(timeout);

            resolve(response);
        }).catch(err =>{
            clearTimeout(timeout);
            reject(err);
        });
    });
}
