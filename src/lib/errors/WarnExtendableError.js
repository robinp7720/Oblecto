import ExtendableError from './ExtendableError';

export default class WarnExtendableError extends ExtendableError {
    constructor(message) {
        super(message);

        this.level = 'WARN';
    }
}
