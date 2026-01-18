import WarnExtendableError from '../lib/errors/WarnExtendableError';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * @param config - Axios request config
 */
export default function<T = any> (config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return new Promise<AxiosResponse<T>>(function(resolve, reject) {
        let timedout = false;
        const timeoutDuration = 20000;
        const axiosTimeout = 10000;

        const timeout = setTimeout(() => {
            timedout = true;

            reject(new WarnExtendableError(`Axios timeout failed and promise timeout expired for ${config.url}`));
        }, timeoutDuration);

        config.timeout = axiosTimeout;

        axios(config).then(response => {
            if (timedout) return;

            clearTimeout(timeout);

            resolve(response);
        }).catch(err =>{
            clearTimeout(timeout);
            reject(err);
        });
    });
}
