import WarnExtendableError from '../lib/errors/WarnExtendableError';

export default function (promise, time) {
    return new Promise(function(resolve, reject) {
        let timedout = false;
        let timeout = setTimeout(() => {
            timedout = true;

            reject(new WarnExtendableError('A promise has timed out'));
        }, time || 10000);


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
