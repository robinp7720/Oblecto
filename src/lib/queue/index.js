import async from 'async';
import logger from '../../submodules/logger';

export default class Queue {
    constructor(concurrency) {
        this.jobs = {};

        this.queue = async.priorityQueue((job, callback) => {
            if (!this.jobs[job.id]) return callback();

            let jobTimeout = setTimeout(() => {
                logger.log('WARN', `Job ${job.id} is taking a long time. Maybe something is wrong?`, JSON.stringify(job));
            }, 20000);

            this.jobs[job.id](job.attr)
                .then(() => {
                    clearTimeout(jobTimeout);

                    callback();
                })
                .catch((err) => {
                    clearTimeout(jobTimeout);

                    logger.log(err);

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
        }, 5);
    }

    lowPriorityJob(id, job) {
        this.queue.push({
            id,
            attr: job
        }, 20);
    }



    /**
     *  Add a job to the front of the queue
     * @param {string} id
     * @param {object} job
     */
    pushJob(id, job) {
        this.queue.push({
            id,
            attr: job
        },0);
    }
}
