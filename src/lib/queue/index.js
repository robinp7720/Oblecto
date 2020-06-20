import async from 'async';

export default class Queue {
    constructor(concurrency) {
        this.jobs = {};

        this.queue = async.queue((job, callback) => {
            if (!this.jobs[job.id]) return callback();

            this.jobs[job.id](job.attr)
                .then((msg) => {
                    if (msg) console.log(msg);
                    callback();
                })
                .catch((err) => {
                    console.log(err.name);

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
