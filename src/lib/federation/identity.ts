import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, createPublicKey, generateKeyPair, randomUUID, sign, verify, X509Certificate } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { configPath } from '../../config.js';
import { record, text } from './protocol.js';
import type { IConfig } from '../../interfaces/config.js';
export interface Identity {
    uuid: string;
    address: string;
    dataPort: number;
    mediaPort: number;
    certificate: string;
    publicKey: string;
}
export const fingerprint = (certificate: string): string => new X509Certificate(certificate).fingerprint256;
export const publicKeyPEM = (key: string): string => createPublicKey(key).export({ type: 'spki', format: 'pem' }) as string;
export const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
export function validateIdentity(input: unknown): Identity {
    const value = record(input);
    const uuid = text(value.uuid, 128);
    if (!/^[a-zA-Z0-9_-]+$/.test(uuid) || ['local', '__proto__', 'constructor', 'prototype'].includes(uuid))
        throw new Error('Invalid server identity');
    const address = text(value.address, 253);
    if (!/^[a-zA-Z0-9.:-]+$/.test(address))
        throw new Error('Enter a hostname or IP address');
    for (const key of ['dataPort', 'mediaPort'])
        if (!Number.isInteger(value[key]) || Number(value[key]) < 1 || Number(value[key]) > 65535)
            throw new Error('Invalid federation port');
    const certificate = text(value.certificate, 16000);
    const publicKey = text(value.publicKey, 8000);
    const cert = new X509Certificate(certificate);
    const key = createPublicKey(publicKey);
    if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048)
        throw new Error('Use an RSA key of at least 2048 bits');
    if (cert.publicKey.export({ type: 'spki', format: 'pem' }) !== key.export({ type: 'spki', format: 'pem' }))
        throw new Error('Certificate and identity key do not match');
    if (Date.parse(cert.validTo) <= Date.now())
        throw new Error('Certificate has expired');
    return {
        uuid, address, dataPort: Number(value.dataPort), mediaPort: Number(value.mediaPort), certificate, publicKey
    };
}
export function proof(key: string, nonce: string, purpose = 'authenticate'): string { return sign('sha256', Buffer.from(`oblecto-federation-v2:${purpose}:${nonce}`), key).toString('base64'); }
export function checkProof(key: string, nonce: string, signature: unknown, purpose = 'authenticate'): boolean {
    try {
        return verify('sha256', Buffer.from(`oblecto-federation-v2:${purpose}:${nonce}`), key, Buffer.from(text(signature, 8000), 'base64'));
    }
    catch {
        return false;
    }
}
export async function identity(config: IConfig['federation']): Promise<Identity> {
    const key = await fs.readFile(config.key, 'utf8');
    return validateIdentity({
        uuid: config.uuid, address: config.address, dataPort: config.dataPort, mediaPort: config.mediaPort, certificate: await fs.readFile(config.cert!, 'utf8'), publicKey: createPublicKey(key).export({ type: 'spki', format: 'pem' })
    });
}
/** Used only by explicit guided setup. Existing identity material is never overwritten. */
export async function provision(config: IConfig['federation'], address: string): Promise<IConfig['federation']> {
    if (!/^[a-zA-Z0-9.:-]+$/.test(address))
        throw new Error('Enter a hostname or IP address');
    const next = structuredClone(config);
    next.address = address;
    const directory = path.join(path.dirname(configPath()), 'federation');
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const keyExists = await fs.access(next.key).then(() => true, () => false);
    if (!keyExists) {
        next.key = path.join(directory, 'identity.pem');
        if (!await fs.access(next.key).then(() => true, () => false)) {
            const keys = await promisify(generateKeyPair)('rsa', {
                modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' }
            });
            await fs.writeFile(next.key, keys.privateKey, { flag: 'wx', mode: 0o600 });
        }
    }
    if (!next.cert || !await fs.access(next.cert).then(() => true, () => false)) {
        next.cert = path.join(directory, `certificate-${randomUUID()}.pem`);
        const san = /^[\d.]+$/.test(address) || address.includes(':') ? `IP:${address}` : `DNS:${address}`;
        await promisify(execFile)('openssl', ['req', '-new', '-x509', '-key', next.key, '-out', next.cert, '-days', '365', '-subj', `/CN=${address}`, '-addext', `subjectAltName=${san}`], { timeout: 10000 });
    }
    next.uuid ||= randomUUID();
    await identity(next);
    return next;
}
export async function storeTrust(remote: Identity): Promise<{
    ca: string;
    key: string;
}> {
    const directory = path.join(path.dirname(configPath()), 'federation', 'trust');
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const stem = path.join(directory, `${remote.uuid}-${digest(remote.certificate).slice(0, 16)}`);
    await fs.writeFile(`${stem}.crt`, remote.certificate, { mode: 0o600 });
    await fs.writeFile(`${stem}.pub`, remote.publicKey, { mode: 0o600 });
    return { ca: `${stem}.crt`, key: `${stem}.pub` };
}
