import * as os from 'os';
import * as fs from 'fs';
import logger from '../../submodules/logger/index.js';
import { MediaSession } from './MediaSession.js';

import type { File } from '../../models/file.js';
import type Oblecto from '../oblecto/index.js';
import type { Streamer, MediaSessionOptions } from './types.js';

// Import built-in streamers
import { DirectStreamer } from './streamers/DirectStreamer.js';
import { DirectHttpStreamer } from './streamers/DirectHttpStreamer.js';
import { TranscodeStreamer } from './streamers/TranscodeStreamer.js';
import { HlsStreamer } from './streamers/HlsStreamer.js';
import { FederationStreamer } from './streamers/FederationStreamer.js';

type SessionMap = Record<string, MediaSession>;

/**
 * Controller for managing media streaming sessions.
 * 
 * Uses a registry pattern to allow adding new streamer types without
 * modifying the controller code.
 */
export class MediaSessionController {
    public readonly oblecto: Oblecto;
    public readonly sessions: SessionMap = {};

    private streamers: Map<string, Streamer> = new Map();

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        // Register built-in streamers
        this.registerBuiltInStreamers();
    }

    /**
     * Register all built-in streamer implementations
     */
    private registerBuiltInStreamers(): void {
        this.registerStreamer(new DirectStreamer());
        this.registerStreamer(new DirectHttpStreamer());
        this.registerStreamer(new TranscodeStreamer());
        this.registerStreamer(new HlsStreamer());
        this.registerStreamer(new FederationStreamer());
    }

    /**
     * Register a streamer plugin
     * @param streamer
     */
    registerStreamer(streamer: Streamer): void {
        if (this.streamers.has(streamer.type)) {
            logger.warn(`Streamer type "${streamer.type}" already registered, overwriting`);
        }
        this.streamers.set(streamer.type, streamer);
        logger.debug(`Registered streamer: ${streamer.type} (priority: ${streamer.priority})`);
    }

    /**
     * Unregister a streamer plugin
     * @param type
     */
    unregisterStreamer(type: string): boolean {
        return this.streamers.delete(type);
    }

    /**
     * Get a list of registered streamer types
     */
    getStreamerTypes(): string[] {
        return Array.from(this.streamers.keys());
    }

    /**
     * Create a new streaming session for a file
     * @param file - File to stream
     * @param options - Session options
     * @returns The created session
     */
    newSession(file: File, options: MediaSessionOptions): MediaSession {
        const session = this.createSession(file, options);

        this.sessions[session.sessionId] = session;

        session.on('close', () => {
            logger.info(`MediaSession ${session.sessionId} closed, removing from controller`);
            delete this.sessions[session.sessionId];
        });

        return session;
    }

    /**
     * Create a session using the appropriate streamer
     * @param file
     * @param options
     */
    private createSession(file: File, options: MediaSessionOptions): MediaSession {
        // If explicit type requested, use that streamer
        if (options.streamType) {
            const streamer = this.streamers.get(options.streamType);

            if (streamer) {
                logger.debug(`Creating session with explicit streamer: ${options.streamType}`);
                return streamer.createSession(file, options, this.oblecto);
            }
            logger.warn(`Requested streamer type "${options.streamType}" not found, auto-selecting`);
        }

        // Auto-select the best streamer based on priority and compatibility
        const selectedStreamer = this.selectStreamer(file, options);

        logger.debug(`Auto-selected streamer: ${selectedStreamer.type}`);
        return selectedStreamer.createSession(file, options, this.oblecto);
    }

    /**
     * Select the best streamer for the given file and options
     * @param file
     * @param options
     */
    private selectStreamer(file: File, options: MediaSessionOptions): Streamer {
        // Sort streamers by priority (lower = higher priority)
        const sortedStreamers = Array.from(this.streamers.values())
            .sort((a, b) => a.priority - b.priority);

        for (const streamer of sortedStreamers) {
            if (streamer.canHandle(file, options, this.oblecto)) {
                return streamer;
            }
        }

        // Fallback to transcode streamer (should always be able to handle)
        const transcodeStreamer = this.streamers.get('transcode');

        if (transcodeStreamer) {
            return transcodeStreamer;
        }

        throw new Error('No suitable streamer found for file');
    }

    /**
     * Get an existing session by ID
     * @param sessionId
     */
    getSession(sessionId: string): MediaSession | undefined {
        return this.sessions[sessionId];
    }

    /**
     * Check if a session exists
     * @param sessionId
     */
    sessionExists(sessionId: string): boolean {
        return sessionId in this.sessions;
    }

    /**
     * Get all active sessions
     */
    getSessions(): MediaSession[] {
        return Object.values(this.sessions);
    }

    /**
     * End all sessions and cleanup
     */
    close(): void {
        for (const session of Object.values(this.sessions)) {
            session.endSession();
        }

        // Ensure any leftover HLS session temp data is removed on shutdown.
        const sessionRoot = `${os.tmpdir()}/oblecto/sessions`;

        try {
            fs.rmSync(sessionRoot, { recursive: true, force: true });
        } catch (error) {
            logger.warn('Failed to remove HLS session temp directory on shutdown', error);
        }
    }
}

export default MediaSessionController;
