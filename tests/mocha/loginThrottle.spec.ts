import assert from 'node:assert/strict';
import { LoginThrottle } from '../../src/lib/auth/loginThrottle.js';

describe('Login throttle', () => {
    let now: number;
    let throttle: LoginThrottle;

    beforeEach(() => {
        now = 1_000_000;
        throttle = new LoginThrottle(() => now);
    });

    it('allows five failures for an account from one address, then asks it to wait', () => {
        for (let i = 0; i < 5; i++) {
            assert.equal(throttle.retryAfter('10.0.0.2', 'alice'), 0);
            throttle.failed('10.0.0.2', 'alice');
        }

        assert.ok(throttle.retryAfter('10.0.0.2', 'alice') > 0);
    });

    it('does not lock the account out for other addresses', () => {
        for (let i = 0; i < 5; i++) throttle.failed('10.0.0.2', 'alice');

        assert.equal(throttle.retryAfter('10.0.0.3', 'alice'), 0);
    });

    it('limits one address guessing across many accounts', () => {
        for (let i = 0; i < 20; i++) throttle.failed('10.0.0.2', `user${i}`);

        assert.ok(throttle.retryAfter('10.0.0.2', 'someone-new') > 0);
    });

    it('forgets failures after fifteen minutes, and after a successful sign-in', () => {
        for (let i = 0; i < 5; i++) throttle.failed('10.0.0.2', 'alice');
        now += 15 * 60 * 1000;
        assert.equal(throttle.retryAfter('10.0.0.2', 'alice'), 0);

        for (let i = 0; i < 4; i++) throttle.failed('10.0.0.2', 'bob');
        throttle.succeeded('10.0.0.2', 'bob');
        throttle.failed('10.0.0.2', 'bob');
        assert.equal(throttle.retryAfter('10.0.0.2', 'bob'), 0);
    });

    it('treats usernames case-insensitively', () => {
        for (let i = 0; i < 5; i++) throttle.failed('10.0.0.2', i % 2 ? 'Alice' : 'ALICE');

        assert.ok(throttle.retryAfter('10.0.0.2', 'alice') > 0);
    });
});
