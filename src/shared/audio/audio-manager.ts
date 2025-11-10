import { sound } from '@pixi/sound';
import type { PlayOptions } from '@pixi/sound';
import { AUDIO_ASSET_URLS } from '../config/manifest';

type AudioCueId = keyof typeof AUDIO_ASSET_URLS;

const MERGE_SMALL_MAX_TIER = 4;
const MERGE_MEDIUM_MAX_TIER = 8;
const MERGE_BIG_MAX_TIER = 10;

const DEFAULT_OPTIONS: PlayOptions = {
    volume: 0.7
};

const clampVolume = (value: number | undefined): number => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return 1;
    }
    if (value < 0) {
        return 0;
    }
    if (value > 1) {
        return 1;
    }
    return value;
};

const MUTE_STORAGE_KEY = 'wuidka:audio-muted';

let preferenceLoaded = false;
let muted = false;
let initialized = false;
let unlockListenersBound = false;
let unlocked = false;
let fallbackPrepared = false;
let fallbackPrimed = false;

const audioCueIds = Object.keys(AUDIO_ASSET_URLS) as AudioCueId[];
const htmlAudioPools = new Map<AudioCueId, HTMLAudioElement[]>();

const unlockEvents: Array<keyof WindowEventMap> = ['pointerdown', 'touchend', 'mousedown'];

const isSafariFamily = (): boolean => {
    if (typeof navigator === 'undefined') {
        return false;
    }
    const ua = navigator.userAgent ?? '';
    const isIOS = /iPad|iPhone|iPod/i.test(ua);
    const isSafari =
        /Safari/i.test(ua) &&
        !/(Chrome|CriOS|FxiOS|Edg|EdgiOS|OPR|OPiOS|Brave|DuckDuckGo|SamsungBrowser)/i.test(ua);
    const isMac = /Macintosh/i.test(ua);
    return isIOS || (isSafari && isMac);
};

const shouldPreferHtmlAudio = isSafariFamily();

const hasHtmlAudioSupport = (): boolean => typeof window !== 'undefined' && typeof Audio !== 'undefined';

const getFallbackPool = (id: AudioCueId): HTMLAudioElement[] => {
    const existing = htmlAudioPools.get(id);
    if (existing) {
        return existing;
    }
    const pool: HTMLAudioElement[] = [];
    htmlAudioPools.set(id, pool);
    return pool;
};

const createHtmlAudioElement = (id: AudioCueId): HTMLAudioElement | undefined => {
    if (!hasHtmlAudioSupport()) {
        return undefined;
    }
    const src = AUDIO_ASSET_URLS[id];
    if (!src) {
        return undefined;
    }
    try {
        const element = new Audio(src);
        element.preload = 'auto';
        element.crossOrigin = 'anonymous';
        element.muted = muted;
        element.load();
        element.addEventListener('ended', () => {
            element.currentTime = 0;
        });
        return element;
    } catch (error) {
        console.warn('[AudioManager] Unable to create fallback audio element', error);
        return undefined;
    }
};

const prepareFallbackAudio = (): void => {
    if (fallbackPrepared || !hasHtmlAudioSupport()) {
        return;
    }
    fallbackPrepared = true;
    audioCueIds.forEach((id) => {
        const pool = getFallbackPool(id);
        if (pool.length > 0) {
            return;
        }
        const element = createHtmlAudioElement(id);
        if (element) {
            pool.push(element);
        }
    });
};

const primeFallbackAudio = (): void => {
    if (!shouldPreferHtmlAudio || fallbackPrimed || !hasHtmlAudioSupport()) {
        return;
    }
    fallbackPrimed = true;
    htmlAudioPools.forEach((pool) => {
        pool.forEach((audio) => {
            const wasMuted = audio.muted;
            audio.muted = true;
            try {
                const playPromise = audio.play();
                if (playPromise?.then) {
                    playPromise
                        .then(() => {
                            audio.pause();
                            audio.currentTime = 0;
                            audio.muted = wasMuted;
                        })
                        .catch(() => {
                            audio.muted = wasMuted;
                        });
                } else {
                    audio.pause();
                    audio.currentTime = 0;
                    audio.muted = wasMuted;
                }
            } catch (error) {
                audio.muted = wasMuted;
            }
        });
    });
};

const setFallbackMuteState = (): void => {
    htmlAudioPools.forEach((pool) => {
        pool.forEach((audio) => {
            audio.muted = muted;
            if (muted) {
                audio.pause();
                audio.currentTime = 0;
            }
        });
    });
};

const playFallbackAudio = (id: AudioCueId, options: PlayOptions): boolean => {
    if (!hasHtmlAudioSupport()) {
        return false;
    }
    prepareFallbackAudio();
    const pool = getFallbackPool(id);
    let audio = pool.find((instance) => instance.paused || instance.ended);
    if (!audio) {
        audio = createHtmlAudioElement(id);
        if (audio) {
            pool.push(audio);
        }
    }
    if (!audio) {
        return false;
    }
    if (muted) {
        return true;
    }
    try {
        audio.currentTime = 0;
        audio.volume = clampVolume(options.volume ?? DEFAULT_OPTIONS.volume);
        const playPromise = audio.play();
        if (playPromise?.catch) {
            playPromise.catch((error) => {
                console.warn('[AudioManager] Unable to play fallback audio', error);
            });
        }
        return true;
    } catch (error) {
        console.warn('[AudioManager] Unable to start fallback audio', error);
        return false;
    }
};

const getAudioContext = (): AudioContext | null => {
    const context = sound.context as unknown as { audioContext?: AudioContext } | undefined;
    if (!context) {
        return null;
    }
    if (context.audioContext) {
        return context.audioContext;
    }
    const maybeInternal = context as Record<string, unknown>;
    if ('_ctx' in maybeInternal) {
        return maybeInternal._ctx as AudioContext;
    }
    return null;
};

const removeUnlockListeners = () => {
    if (!unlockListenersBound || typeof window === 'undefined') {
        return;
    }
    unlockListenersBound = false;
    unlockEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleUnlock, false);
    });
};

const bindUnlockListeners = () => {
    if (unlockListenersBound || unlocked || typeof window === 'undefined') {
        return;
    }
    unlockListenersBound = true;
    unlockEvents.forEach((eventName) => {
        window.addEventListener(eventName, handleUnlock, { passive: true });
    });
};

const handleUnlock = async () => {
    if (!initialized) {
        return;
    }

    prepareFallbackAudio();

    const audioContext = getAudioContext();
    if (!audioContext) {
        applyMuteState();
        primeFallbackAudio();
        unlocked = true;
        removeUnlockListeners();
        return;
    }

    const stateBefore = audioContext.state as string;
    if (stateBefore === 'suspended' || stateBefore === 'interrupted') {
        try {
            await audioContext.resume();
        } catch (error) {
            console.warn('[AudioManager] Unable to resume audio context', error);
        }
    }

    try {
        sound.resumeAll();
    } catch (error) {
        console.warn('[AudioManager] Unable to resume sounds', error);
    }

    applyMuteState();
    primeFallbackAudio();

    const currentState = audioContext.state as string;
    if (currentState === 'running' || currentState === 'closed') {
        unlocked = true;
        removeUnlockListeners();
    }
};

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
    } else {
        sound.unmuteAll();
    }
    setFallbackMuteState();
};

const exists = (id: AudioCueId): boolean => sound.exists(id);

const tryPlayPixiSound = (id: AudioCueId, options: PlayOptions): boolean => {
    if (!initialized || !exists(id)) {
        return false;
    }
    try {
        sound.play(id, options);
        return true;
    } catch (error) {
        console.warn(`[AudioManager] Unable to play Pixi sound "${id}"`, error);
        return false;
    }
};

const play = (id: AudioCueId, options?: Partial<PlayOptions>) => {
    ensurePreferenceLoaded();
    if (muted) {
        return;
    }
    const merged: PlayOptions = { ...DEFAULT_OPTIONS, ...options };
    const pixiPlayed = !shouldPreferHtmlAudio && tryPlayPixiSound(id, merged);
    if (pixiPlayed) {
        return;
    }
    const fallbackPlayed = playFallbackAudio(id, merged);
    if (fallbackPlayed) {
        return;
    }
    if (shouldPreferHtmlAudio) {
        tryPlayPixiSound(id, merged);
    }
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
        if (shouldPreferHtmlAudio) {
            prepareFallbackAudio();
        }
        bindUnlockListeners();
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
    },

    ensureUnlocked(): void {
        if (unlocked) {
            return;
        }
        bindUnlockListeners();
    }
};
