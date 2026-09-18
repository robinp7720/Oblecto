// Per-user preferences. Stored as one JSON column so adding a preference
// needs no schema change; unknown keys are rejected rather than stored.

export type SubtitleMode = 'off' | 'auto' | 'forced';
export type Quality = 'original' | 'auto' | 360 | 480 | 720 | 1080;

export interface UserPreferences {
    // Interface language (BCP 47); null follows the browser
    language: string | null;
    // Preferred audio and subtitle track languages (ISO 639); null keeps the file's default
    audioLanguage: string | null;
    subtitleLanguage: string | null;
    subtitleMode: SubtitleMode;
    quality: Quality;
    // Start the next episode when one ends
    autoplayNext: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
    language: null,
    audioLanguage: null,
    subtitleLanguage: null,
    subtitleMode: 'auto',
    quality: 'original',
    autoplayNext: true,
};

const SUBTITLE_MODES: SubtitleMode[] = ['off', 'auto', 'forced'];
const QUALITIES: Quality[] = ['original', 'auto', 360, 480, 720, 1080];
const LANGUAGE_TAG = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i;

const isLanguage = (value: unknown): value is string | null =>
    value === null || (typeof value === 'string' && value.length <= 35 && LANGUAGE_TAG.test(value));

const validators: { [K in keyof UserPreferences]: (value: unknown) => boolean } = {
    language: isLanguage,
    audioLanguage: isLanguage,
    subtitleLanguage: isLanguage,
    subtitleMode: value => SUBTITLE_MODES.includes(value as SubtitleMode),
    quality: value => QUALITIES.includes(value as Quality),
    autoplayNext: value => typeof value === 'boolean',
};

const messages: { [K in keyof UserPreferences]: string } = {
    language: 'Choose a language code such as "en" or "pt-BR".',
    audioLanguage: 'Choose a language code such as "en" or "jpn".',
    subtitleLanguage: 'Choose a language code such as "en" or "jpn".',
    subtitleMode: `Choose one of ${SUBTITLE_MODES.join(', ')}.`,
    quality: `Choose one of ${QUALITIES.join(', ')}.`,
    autoplayNext: 'Must be true or false.',
};

/**
 * Field errors for a partial update, keyed by preference; empty when valid.
 */
export function validatePreferences(update: unknown): Record<string, string> {
    if (typeof update !== 'object' || update === null || Array.isArray(update))
        return { preferences: 'Preferences must be an object.' };

    const errors: Record<string, string> = {};

    for (const [key, value] of Object.entries(update)) {
        if (!(key in validators)) {
            errors[key] = 'Unknown preference.';
        } else if (!validators[key as keyof UserPreferences](value)) {
            errors[key] = messages[key as keyof UserPreferences];
        }
    }

    return errors;
}

/**
 * Stored preferences with defaults filled in. Values that no longer validate
 * (say, a quality that was removed) fall back to the default.
 */
export function resolvePreferences(stored: unknown): UserPreferences {
    const resolved = { ...DEFAULT_PREFERENCES };

    if (typeof stored !== 'object' || stored === null) return resolved;

    for (const key of Object.keys(DEFAULT_PREFERENCES) as (keyof UserPreferences)[]) {
        const value = (stored as Record<string, unknown>)[key];

        if (value !== undefined && validators[key](value)) (resolved as Record<string, unknown>)[key] = value;
    }

    return resolved;
}
