import WarnExtendableError from '../lib/errors/WarnExtendableError';

/**
 * Add a timeout to a promise
 * @param promise - Promise to which the timeout should be added
 * @param time - Timeout milliseconds
 */
export default function<T> (promise: Promise<T>, time: number = 10000): Promise<T> {
    return new Promise<T>(function(resolve, reject) {
        let timedout = false;
        const timeout = setTimeout(() => {
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
