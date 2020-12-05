import async from 'async';
import logger from '../../submodules/logger';

export default class Queue {
    /**
     *
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;

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
        }, this.oblecto.config.queue.concurrency);
    }

    /**
     *  Define a new job
     * @param {string} id
     * @param {function} job
     */
    registerJob(id, job) {
        if (this.jobs[id]) {
            logger.log('ERROR', `A job has been registered which was already registered: ${id}`);
            logger.log('ERROR', 'This should not happen. Shutting down server');

            this.oblecto.close();

            return;
        }

        logger.log('INFO', 'New queue item has been registered:', id);

        this.jobs[id] = job;
    }

    /**
     *  Add a job to the end of the queue
     * @param {string} id
     * @param {object} attr
     * @param {number} priority
     */
    queueJob(id, attr, priority = 5) {
        this.queue.push({id, attr}, priority);
    }

    /**
     *  Adds a queue which should be completed as soon as possible
     * @param {string} id
     * @param {object} attr
     */
    lowPriorityJob(id, attr) {
        this.queueJob(id, attr, 20);
    }

    /**
     *  Add a job to the front of the queue
     * @param {string} id
     * @param {object} attr
     */
    pushJob(id, attr) {
        this.queueJob(id, attr, 0);
    }
}
