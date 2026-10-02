// The server settings a Jellyfin app's dashboard shows and edits, read from and saved to Oblecto's
// own configuration. Only the settings both have in common are real; the rest are Jellyfin's
// defaults, shown so the dashboard works, and never stored.
import { ConfigManager } from '../../../config.js';
import { mergeSettings, validateSettings } from '../../settings/validation.js';
import { WATCHED_PROGRESS } from '../../playback/progress.js';

import type EmbyEmulation from '../index.js';

type Dto = Record<string, unknown>;
type Updates = Record<string, Record<string, unknown>>;

/** A settings change Oblecto refused, with the reason to show. */
export class ConfigurationError extends Error {
    constructor(message: string, public statusCode = 400) {
        super(message);
    }
}

// Oblecto's hardware encoders, by the name Jellyfin gives them
const ACCELERATORS: Record<string, string> = {
    cuda: 'nvenc',
    vaapi: 'vaapi'
};

export function systemConfiguration(embyEmulation: EmbyEmulation): Dto {
    return {
        ServerName: embyEmulation.serverName,
        CachePath: '/config/cache',
        MetadataPath: '/config/data/metadata',
        MetadataCountryCode: 'US',
        PreferredMetadataLanguage: 'en',
        UICulture: 'en-US',
        QuickConnectAvailable: false,
        IsStartupWizardCompleted: true,
        EnableFolderView: false,
        EnableGroupingMoviesIntoCollections: true,
        EnableGroupingShowsIntoCollections: true,
        DisplaySpecialsWithinSeasons: true,
        EnableLegacyAuthorization: false,
        EnableCaseSensitiveItemIds: false,
        EnableNormalizedItemByNameIds: true,
        ImageSavingConvention: 'Compatible',
        ImageExtractionTimeoutMs: 15000,
        LibraryMonitorDelay: 60,
        LibraryUpdateDuration: 300,
        LibraryMetadataRefreshConcurrency: 1,
        LibraryScanFanoutConcurrency: 1,
        LogFileRetentionDays: 7,
        ActivityLogRetentionDays: 7,
        // Anything started can be resumed; past the end credits it counts as watched
        MinResumePct: 0,
        MaxResumePct: Math.round(WATCHED_PROGRESS * 100),
        MinResumeDurationSeconds: 0,
        MinAudiobookResume: 5,
        MaxAudiobookResume: 5,
        InactiveSessionThreshold: 0,
        DummyChapterDuration: 0,
        RemoteClientBitrateLimit: 0,
        SaveMetadataHidden: false,
        EnableExternalContentInSuggestions: false,
        EnableSlowResponseWarning: false,
        SlowResponseThresholdMs: 5000,
        IsPortAuthorized: true,
        CastReceiverApplications: [],
        PathSubstitutions: [],
        MetadataOptions: [],
        PluginRepositories: [],
        CodecsUsed: [],
        ContentTypes: [],
        CorsHosts: [],
        SortRemoveCharacters: [],
        SortRemoveWords: [],
        SortReplaceCharacters: []
    };
}

export function encodingConfiguration(embyEmulation: EmbyEmulation): Dto {
    const transcoding = embyEmulation.oblecto.config.transcoding;
    const accelerator = transcoding?.hardwareAcceleration ? ACCELERATORS[transcoding.hardwareAccelerator] ?? 'none' : 'none';

    return {
        // ffmpeg picks its own thread count
        EncodingThreadCount: -1,
        EnableFallbackFont: false,
        FallbackFontPath: '',
        FontWhitelist: [],
        EnableHardwareEncoding: accelerator !== 'none',
        HardwareAccelerationType: accelerator,
        HardwareDecodingCodecs: [],
        H264Crf: 23,
        H265Crf: 28,
        EncoderPreset: 'veryfast',
        AllowStreamCopy: true,
        EnableEnhancedNvdecDecoder: false,
        EnableTonemapping: false
    };
}

export function brandingConfiguration(embyEmulation: EmbyEmulation): Dto {
    const jellyfin = embyEmulation.oblecto.config.jellyfin;

    return {
        LoginDisclaimer: jellyfin.loginDisclaimer ?? '',
        CustomCss: jellyfin.customCss ?? '',
        SplashscreenEnabled: false
    };
}

/** The Oblecto settings a saved ServerConfiguration changes. */
export function fromSystemConfiguration(body: Dto): Updates {
    return typeof body.ServerName === 'string' ? { jellyfin: { serverName: body.ServerName.trim() } } : {};
}

/** The Oblecto settings a saved EncodingOptions changes. Refuses an encoder Oblecto cannot use. */
export function fromEncodingConfiguration(body: Dto): Updates {
    const type = typeof body.HardwareAccelerationType === 'string' ? body.HardwareAccelerationType.toLowerCase() : null;

    if (type === null) {
        return typeof body.EnableHardwareEncoding === 'boolean' ? { transcoding: { hardwareAcceleration: body.EnableHardwareEncoding } } : {};
    }

    if (type === 'none' || type === '') return { transcoding: { hardwareAcceleration: false } };

    const accelerator = Object.keys(ACCELERATORS).find(key => ACCELERATORS[key] === type);

    if (!accelerator) throw new ConfigurationError('Oblecto can encode with NVENC or VAAPI, or without hardware acceleration.');

    return {
        transcoding: {
            hardwareAcceleration: body.EnableHardwareEncoding !== false,
            hardwareAccelerator: accelerator
        }
    };
}

/** The Oblecto settings a saved BrandingOptions changes. */
export function fromBrandingConfiguration(body: Dto): Updates {
    const jellyfin: Record<string, unknown> = {};

    if (typeof body.LoginDisclaimer === 'string' || body.LoginDisclaimer === null) jellyfin.loginDisclaimer = body.LoginDisclaimer ?? '';
    if (typeof body.CustomCss === 'string' || body.CustomCss === null) jellyfin.customCss = body.CustomCss ?? '';

    return Object.keys(jellyfin).length > 0 ? { jellyfin } : {};
}

/**
 * Check and save settings changes as the web UI's settings page does. Nothing to change is not an
 * error: a dashboard saves every field, most of which Oblecto does not keep.
 */
export async function saveConfiguration(embyEmulation: EmbyEmulation, updates: Updates): Promise<void> {
    if (Object.keys(updates).length === 0) return;

    const config = embyEmulation.oblecto.config;
    const problems = validateSettings(updates, config as unknown as Record<string, unknown>);

    if (Object.keys(problems).length > 0) throw new ConfigurationError(Object.values(problems).join(' '));

    await ConfigManager.updateConfig(draft => mergeSettings(draft, updates), config);
}
