import async from 'async';
import logger from '../../submodules/logger';

export default class Queue {
    /**
     *
     * @param {number} concurrency - Amount of tasks to handle simultaneously
     */
    constructor(concurrency) {
        this.jobs = {};

        this.queue = async.priorityQueue((job, callback) => {
            if (!this.jobs[job.id]) return callback();

            let jobTimeout = setTimeout(() => {
                // logger.debug( `Job ${job.id} is taking a long time. Maybe something is wrong?`, JSON.stringify(job));
            }, 20000);

            this.jobs[job.id](job.attr)
                .then(() => {
                    clearTimeout(jobTimeout);

                    callback();
                })
                .catch((err) => {
                    clearTimeout(jobTimeout);

                    if (err.level) {
                        logger.log(err.level, err);
                    } else {
                        logger.error(err);
                    }

                    callback();
                });
        }, concurrency);
    }

    /**
     *  Define a new job
     * @param {string} id - ID/Name for job
     * @param {Function} job - Function used for Queue item
     */
    registerJob(id, job) {
        if (this.jobs[id]) {
            logger.error( `A job has been registered which was already registered: ${id}`);
            logger.error( 'This should not happen');

            return;
        }

        logger.info( 'New queue item has been registered:', id);

        this.jobs[id] = job;
    }

    /**
     *  Add a job to the end of the queue
     * @param {string} id - Id for the job to be called
     * @param {object} attr - Attributes to be passed to the job
     * @param {number} priority - Priority for the job
     */
    queueJob(id, attr, priority = 5) {
        this.queue.push({ id, attr }, priority);
    }

    /**
     *  Adds a queue which should be completed as soon as possible
     * @param {string} id - Id for the job to be called
     * @param {object} attr - Attributes to be passed to the job
     */
    lowPriorityJob(id, attr) {
        this.queueJob(id, attr, 20);
    }

    /**
     *  Add a job to the front of the queue
     * @param {string} id - Id for the job to be called
     * @param {object} attr - Attributes to be passed the job
     */
    pushJob(id, attr) {
        this.queueJob(id, attr, 0);
    }
}
