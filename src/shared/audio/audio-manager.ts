import { sound } from '@pixi/sound';
import type { PlayOptions } from '@pixi/sound';

type AudioCueId =
    | 'merge-small-sfx'
    | 'merge-medium-sfx'
    | 'merge-big-sfx'
    | 'merge-xl-sfx'
    | 'combo-sfx'
    | 'danger-sfx'
    | 'gameover-sfx';

const MERGE_SMALL_MAX_TIER = 4;
const MERGE_MEDIUM_MAX_TIER = 8;
const MERGE_BIG_MAX_TIER = 10;

const DEFAULT_OPTIONS: PlayOptions = {
    volume: 0.7
};

const MUTE_STORAGE_KEY = 'wuidka:audio-muted';

let preferenceLoaded = false;
let muted = false;
let initialized = false;

const ensurePreferenceLoaded = (): void => {
    if (preferenceLoaded) {
        return;
    }
    preferenceLoaded = true;
    if (typeof window === 'undefined') {
        return;
    }
    try {
        const storedValue = window.localStorage.getItem(MUTE_STORAGE_KEY);
        muted = storedValue === 'true';
    } catch (error) {
        console.warn('[AudioManager] Unable to read mute preference', error);
        muted = false;
    }
};

const persistMutePreference = (value: boolean): void => {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        window.localStorage.setItem(MUTE_STORAGE_KEY, value ? 'true' : 'false');
    } catch (error) {
        console.warn('[AudioManager] Unable to store mute preference', error);
    }
};

const applyMuteState = (): void => {
    if (!initialized) {
        return;
    }
    if (muted) {
        sound.muteAll();
        return;
    }
    sound.unmuteAll();
};

const exists = (id: AudioCueId): boolean => sound.exists(id);

const play = (id: AudioCueId, options?: Partial<PlayOptions>) => {
    ensurePreferenceLoaded();
    if (muted || !exists(id)) {
        return;
    }
    const merged: PlayOptions = { ...DEFAULT_OPTIONS, ...options };
    sound.play(id, merged);
};

export const AudioManager = {
    init(): void {
        ensurePreferenceLoaded();
        if (!initialized) {
            // Importing @pixi/sound registers the Pixi Assets middleware automatically.
            // We ensure the library is ready by touching the shared context once.
            if (!sound.context) {
                sound.init();
            }
            initialized = true;
        }
        applyMuteState();
    },

    playMerge(tierId: number): void {
        if (tierId <= MERGE_SMALL_MAX_TIER) {
            play('merge-small-sfx');
            return;
        }

        if (tierId <= MERGE_MEDIUM_MAX_TIER) {
            play('merge-medium-sfx');
            return;
        }

        if (tierId <= MERGE_BIG_MAX_TIER) {
            play('merge-big-sfx', { volume: 0.75 });
            return;
        }

        play('merge-xl-sfx', { volume: 0.8 });
    },

    playCombo(count: number): void {
        if (count < 2) {
            return;
        }
        play('combo-sfx', { volume: Math.min(1, 0.45 + count * 0.05) });
    },

    playDanger(): void {
        play('danger-sfx', { volume: 0.5 });
    },

    playGameOver(): void {
        play('gameover-sfx', { volume: 0.6 });
    },

    isMuted(): boolean {
        ensurePreferenceLoaded();
        return muted;
    },

    setMuted(nextMuted: boolean): void {
        ensurePreferenceLoaded();
        if (muted === nextMuted) {
            persistMutePreference(muted);
            applyMuteState();
            return;
        }
        muted = nextMuted;
        persistMutePreference(muted);
        applyMuteState();
    },

    toggleMuted(): boolean {
        const nextMuted = !this.isMuted();
        this.setMuted(nextMuted);
        return nextMuted;
    }
};
