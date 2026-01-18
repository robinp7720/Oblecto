export default class ExtendableError extends Error {
    public level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
        this.level = 'ERROR';

        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        } else {
            this.stack = new Error(message).stack;
        }
    }
}
