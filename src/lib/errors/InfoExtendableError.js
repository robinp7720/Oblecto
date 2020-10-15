import ExtendableError from './ExtendableError';

export default class InfoExtendableError extends ExtendableError {
    constructor(message) {
        super(message);

        this.level = 'INFO';
    }
}
