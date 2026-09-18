import assert from 'node:assert/strict';
import { clientAddress, isLocalAddress, parseSubnet } from '../../src/lib/network/localNetwork.js';

const request = (remoteAddress: string, forwardedFor?: string) => ({
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
    socket: { remoteAddress }
}) as any;

describe('local network detection', () => {
    it('treats loopback, private and link-local addresses as local', () => {
        for (const address of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.20', '169.254.3.4', '::1', 'fd12:3456::1', 'fe80::1', '::ffff:192.168.1.5']) {
            assert.equal(isLocalAddress(address), true, address);
        }
    });

    it('treats public and malformed addresses as remote', () => {
        for (const address of ['8.8.8.8', '172.32.0.1', '100.64.0.1', '2001:4860::8888', '::ffff:8.8.8.8', 'not-an-ip', '', undefined]) {
            assert.equal(isLocalAddress(address), false, String(address));
        }
    });

    it('adds configured subnets', () => {
        const authentication = { localSubnets: ['100.64.0.0/10', '203.0.113.7'] };

        assert.equal(isLocalAddress('100.100.1.1', authentication), true);
        assert.equal(isLocalAddress('203.0.113.7', authentication), true);
        assert.equal(isLocalAddress('203.0.113.8', authentication), false);
    });

    it('parses subnets and rejects bad ones', () => {
        assert.deepEqual(parseSubnet('192.168.0.0/16'), { address: '192.168.0.0', prefix: 16, family: 'ipv4' });
        assert.deepEqual(parseSubnet('2001:db8::/32'), { address: '2001:db8::', prefix: 32, family: 'ipv6' });
        assert.equal(parseSubnet('10.0.0.1')?.prefix, 32);
        for (const bad of ['10.0.0.0/33', '10.0.0.0/', '10.0.0.0/8/1', 'example.com/24', '10.0.0.0/-1']) {
            assert.equal(parseSubnet(bad), null, bad);
        }
    });

    it('only believes X-Forwarded-For behind a trusted proxy', () => {
        const req = request('127.0.0.1', '8.8.8.8, 10.0.0.1');

        assert.equal(clientAddress(req, {}), '127.0.0.1');
        assert.equal(clientAddress(req, { trustProxy: true }), '8.8.8.8');
        assert.equal(clientAddress(request('10.0.0.2'), { trustProxy: true }), '10.0.0.2');
    });
});
