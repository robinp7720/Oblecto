import async from 'async';
import logger from '../../submodules/logger';

export default class Queue {
    constructor(concurrency) {
        this.jobs = {};

        this.queue = async.queue((job, callback) => {
            if (!this.jobs[job.id]) return callback();

            this.jobs[job.id](job.attr)
                .then(() => {
                    callback();
                })
                .catch((err) => {
                    callback();
                });
        }, concurrency);
    }

    /**
     *  Define a new job
     * @param {string} id
     * @param {function} job
     */
    addJob (id, job) {
        logger.log('INFO', 'New queue item has been registered:', id);

        this.jobs[id] = job;
    }

    /**
     *  Add a job to the end of the queue
     * @param {string} id
     * @param {object} job
     */
    queueJob(id, job) {
        this.queue.push({
            id,
            attr: job
        });
    }

    /**
     *  Add a job to the front of the queue
     * @param {string} id
     * @param {object} job
     */
    pushJob(id, job) {
        this.queue.unshift({
            id,
            attr: job
        });
    }
}
