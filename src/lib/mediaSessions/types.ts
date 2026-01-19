import type { Response, Request } from 'express';
import type * as Stream from 'stream';
import type { File } from '../../models/file.js';
import type Oblecto from '../oblecto/index.js';

/**
 * Options for creating a media session
 */
export interface MediaSessionOptions {
    /** Target container formats in order of preference */
    target: {
        formats: string[];
        videoCodecs: string[];
        audioCodecs: string[];
    };
    /** Seek offset in seconds */
    offset?: number;
    /** Explicit streamer type to use */
    streamType?: string;
}

/**
 * Destination where media data will be sent
 */
export interface StreamDestination {
    type: 'http' | 'stream';
    stream: Response | Stream.Writable;
    request?: Request;
}

/**
 * HTTP destination with guaranteed request object
 */
export interface HttpDestination extends StreamDestination {
    type: 'http';
    stream: Response;
    request: Request;
}

/**
 * Events emitted by MediaSession
 */
export interface MediaSessionEvents {
    close: () => void;
    error: (error: Error) => void;
    start: () => void;
    pause: () => void;
    resume: () => void;
}

/**
 * Session state
 */
export type MediaSessionState = 'idle' | 'starting' | 'streaming' | 'paused' | 'ended';

/**
 * Session info for external consumers
 */
export interface MediaSessionInfo {
    sessionId: string;
    state: MediaSessionState;
    file: {
        id: number;
        path: string | null;
        videoCodec: string | null;
        audioCodec: string | null;
    };
    output: {
        format: string;
        videoCodec: string | null;
        audioCodec: string | null;
    };
    seekMode: 'client' | 'server';
    destinationCount: number;
}

/**
 * Interface that streamer plugins must implement
 */
export interface Streamer {
    /** Unique identifier for this streamer type */
    readonly type: string;
    
    /** Priority for auto-selection (lower = higher priority) */
    readonly priority: number;
    
    /**
     * Check if this streamer can handle the given file and options
     */
    canHandle(file: File, options: MediaSessionOptions, oblecto: Oblecto): boolean;
    
    /**
     * Create a new media session for the given file
     */
    createSession(file: File, options: MediaSessionOptions, oblecto: Oblecto): MediaSession;
}

// Forward declaration - actual implementation in MediaSession.ts
export type { MediaSession } from './MediaSession.js';
