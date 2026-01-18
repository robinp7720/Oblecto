import ExtendableError from './ExtendableError';

export default class InfoExtendableError extends ExtendableError {
    constructor(message: string) {
        super(message);

        this.level = 'INFO';
    }
}
