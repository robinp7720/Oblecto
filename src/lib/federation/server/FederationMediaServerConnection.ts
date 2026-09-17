import type tls from 'node:tls';
import type Oblecto from '../../oblecto/index.js';
import { acceptPlaybackPeer } from '../../playback/federation.js';
/** Media protocol v1 is framed independently from the unchanged federation metadata protocol. */
export default class FederationMediaServerConnection {
    constructor(oblecto: Oblecto, socket: tls.TLSSocket) { acceptPlaybackPeer(oblecto, socket); }
}
