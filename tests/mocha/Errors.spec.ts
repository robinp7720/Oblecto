
import assert from 'node:assert/strict';
import ExtendableError from '../../src/lib/errors/ExtendableError.js';
import DebugExtendableError from '../../src/lib/errors/DebugExtendableError.js';
import InfoExtendableError from '../../src/lib/errors/InfoExtendableError.js';
import WarnExtendableError from '../../src/lib/errors/WarnExtendableError.js';

describe('Errors', function () {
    describe('ExtendableError', function () {
        it('should have default level ERROR', function () {
            const error = new ExtendableError('test message');
            assert.equal(error.message, 'test message');
            assert.equal(error.name, 'ExtendableError');
            assert.equal(error.level, 'ERROR');
            assert.ok(error.stack);
        });

        it('should capture stack trace', function () {
            const error = new ExtendableError('stack test');
            assert.ok(error.stack?.includes('Errors.spec.ts'));
        });
    });

    describe('DebugExtendableError', function () {
        it('should have level DEBUG', function () {
            const error = new DebugExtendableError('debug message');
            assert.equal(error.message, 'debug message');
            assert.equal(error.name, 'DebugExtendableError');
            assert.equal(error.level, 'DEBUG');
        });
    });

    describe('InfoExtendableError', function () {
        it('should have level INFO', function () {
            const error = new InfoExtendableError('info message');
            assert.equal(error.message, 'info message');
            assert.equal(error.name, 'InfoExtendableError');
            assert.equal(error.level, 'INFO');
        });
    });

    describe('WarnExtendableError', function () {
        it('should have level WARN', function () {
            const error = new WarnExtendableError('warn message');
            assert.equal(error.message, 'warn message');
            assert.equal(error.name, 'WarnExtendableError');
            assert.equal(error.level, 'WARN');
        });
    });
});
