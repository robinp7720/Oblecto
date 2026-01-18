import ExtendableError from './ExtendableError';

export default class WarnExtendableError extends ExtendableError {
    constructor(message: string) {
        super(message);

        this.level = 'WARN';
    }
}
