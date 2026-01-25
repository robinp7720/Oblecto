
import expect from 'expect.js';
import ExtendableError from '../../src/lib/errors/ExtendableError.js';
import DebugExtendableError from '../../src/lib/errors/DebugExtendableError.js';
import InfoExtendableError from '../../src/lib/errors/InfoExtendableError.js';
import WarnExtendableError from '../../src/lib/errors/WarnExtendableError.js';

describe('Errors', function () {
    describe('ExtendableError', function () {
        it('should have default level ERROR', function () {
            const error = new ExtendableError('test message');
            expect(error.message).to.be('test message');
            expect(error.name).to.be('ExtendableError');
            expect(error.level).to.be('ERROR');
            expect(error.stack).to.be.ok();
        });

        it('should capture stack trace', function () {
            const error = new ExtendableError('stack test');
            expect(error.stack).to.contain('Errors.spec.ts');
        });
    });

    describe('DebugExtendableError', function () {
        it('should have level DEBUG', function () {
            const error = new DebugExtendableError('debug message');
            expect(error.message).to.be('debug message');
            expect(error.name).to.be('DebugExtendableError');
            expect(error.level).to.be('DEBUG');
        });
    });

    describe('InfoExtendableError', function () {
        it('should have level INFO', function () {
            const error = new InfoExtendableError('info message');
            expect(error.message).to.be('info message');
            expect(error.name).to.be('InfoExtendableError');
            expect(error.level).to.be('INFO');
        });
    });

    describe('WarnExtendableError', function () {
        it('should have level WARN', function () {
            const error = new WarnExtendableError('warn message');
            expect(error.message).to.be('warn message');
            expect(error.name).to.be('WarnExtendableError');
            expect(error.level).to.be('WARN');
        });
    });
});
