import net from 'net';
import type { Request } from 'express';
import type { IConfig } from '../../interfaces/config.js';

type AuthenticationConfig = IConfig['authentication'];

// Loopback, private (RFC 1918 / IPv6 ULA) and link-local ranges.
const LOCAL_RANGES: [string, number, 'ipv4' | 'ipv6'][] = [
    ['127.0.0.0', 8, 'ipv4'],
    ['10.0.0.0', 8, 'ipv4'],
    ['172.16.0.0', 12, 'ipv4'],
    ['192.168.0.0', 16, 'ipv4'],
    ['169.254.0.0', 16, 'ipv4'],
    ['::1', 128, 'ipv6'],
    ['fc00::', 7, 'ipv6'],
    ['fe80::', 10, 'ipv6'],
];

/** Parses `a.b.c.d/nn` or `v6::/nn` (a bare address is a single host); null if invalid. */
export function parseSubnet(subnet: string): { address: string, prefix: number, family: 'ipv4' | 'ipv6' } | null {
    const [address, prefixText, ...rest] = subnet.trim().split('/');
    const version = net.isIP(address);

    if (!version || rest.length) return null;

    const family = version === 4 ? 'ipv4' : 'ipv6';
    const max = version === 4 ? 32 : 128;
    const prefix = prefixText === undefined ? max : Number(prefixText);

    if (!/^\d+$/.test(prefixText ?? String(max)) || prefix > max) return null;

    return {
        address, prefix, family
    };
}

function normalise(address: string): string {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);

    return mapped ? mapped[1] : address;
}

export function isLocalAddress(address: string | undefined, authentication?: Partial<AuthenticationConfig>): boolean {
    if (!address) return false;

    const ip = normalise(address.trim());
    const version = net.isIP(ip);

    if (!version) return false;

    const list = new net.BlockList();

    for (const [range, prefix, family] of LOCAL_RANGES) list.addSubnet(range, prefix, family);

    for (const subnet of authentication?.localSubnets ?? []) {
        const parsed = parseSubnet(subnet);

        if (parsed) list.addSubnet(parsed.address, parsed.prefix, parsed.family);
    }

    return list.check(ip, version === 4 ? 'ipv4' : 'ipv6');
}

/** The address the request came from; X-Forwarded-For is only believed when trustProxy is set. */
export function clientAddress(req: Pick<Request, 'headers' | 'socket'>, authentication?: Partial<AuthenticationConfig>): string | undefined {
    if (authentication?.trustProxy) {
        const header = req.headers['x-forwarded-for'];
        const forwarded = (Array.isArray(header) ? header[0] : header)?.split(',')[0]?.trim();

        if (forwarded) return forwarded;
    }

    return req.socket?.remoteAddress;
}

export function isLocalRequest(req: Pick<Request, 'headers' | 'socket'>, authentication?: Partial<AuthenticationConfig>): boolean {
    return isLocalAddress(clientAddress(req, authentication), authentication);
}
