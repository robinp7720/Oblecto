import ExtendableError from './ExtendableError';

export default class DebugExtendableError extends ExtendableError {
    constructor(message) {
        super(message);

        this.level = 'DEBUG';
    }
}
