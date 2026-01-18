import ExtendableError from './ExtendableError';

export default class DebugExtendableError extends ExtendableError {
    constructor(message: string) {
        super(message);

        this.level = 'DEBUG';
    }
}
