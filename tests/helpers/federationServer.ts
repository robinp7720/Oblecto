import { initDatabase } from '../../src/submodules/database.js';
import { migrate } from '../../src/submodules/migrations/index.js';
import config from '../../src/config.js';
import { FederationService } from '../../src/lib/federation/FederationService.js';
import { PlaybackService } from '../../src/lib/playback/PlaybackService.js';
import { connectPlaybackPeer } from '../../src/lib/playback/federation.js';
import { File } from '../../src/models/file.js';
import { Movie } from '../../src/models/movie.js';
import type Oblecto from '../../src/lib/oblecto/index.js';

const database = initDatabase(); await migrate(database);
const oblecto = { config, database } as Oblecto;
oblecto.playback = new PlaybackService(oblecto);
oblecto.playback.remoteFactory = host => connectPlaybackPeer(oblecto, host);
oblecto.federation = new FederationService(oblecto);
await oblecto.federation.start();
const local = await File.create({ host: 'local', path: process.env.FEDERATION_TEST_MEDIA!, name: config.federation.uuid, extension: 'mp4' });
const movie = await Movie.create({ tmdbid: Number(process.env.FEDERATION_TEST_MOVIE), movieName: config.federation.uuid });
await movie.addFile(local);
process.send?.({ ready: true });
process.on('message', (message: { id: string; op: string; args: any }) => {
    void (async () => {
        const { op, args } = message; let value: unknown;
        if (op === 'status') value = oblecto.federation.status();
        else if (op === 'invite') value = await oblecto.federation.invitation();
        else if (op === 'cancelPairing') await oblecto.federation.cancelPairing(args);
        else if (op === 'pair') value = await oblecto.federation.pair(args);
        else if (op === 'restart') { await oblecto.federation.close(); oblecto.federation = new FederationService(oblecto); await oblecto.federation.start(); }
        else if (op === 'files') value = (await File.findAll()).map(file => file.get());
        else if (op === 'sync') value = oblecto.federation.syncNow(args);
        else if (op === 'remove') await oblecto.federation.removePeer(args);
        else if (op === 'revokeInvitation') await oblecto.federation.revokeInvitation(args);
        else if (op === 'config') await oblecto.federation.configure(draft => Object.assign(draft.federation, args));
        else if (op === 'deleteLocal') await File.destroy({ where: { host: 'local' } });
        else if (op === 'play') {
            const file = await File.findOne({ where: { host: args } });
            if (!file) throw new Error('No imported file');
            const session = await oblecto.playback.create(file, 'viewer:test', null, {});
            value = { duration: session.media.duration, remote: Boolean(session.remote) };
            await oblecto.playback.stop(session);
        } else if (op === 'close') {
            await oblecto.federation.close(); await oblecto.playback.close(); await database.close();
        } else throw new Error('Unknown operation');
        process.send?.({ id: message.id, value });
        if (op === 'close') process.disconnect();
    })().catch(error => process.send?.({ id: message.id, error: String(error) }));
});
