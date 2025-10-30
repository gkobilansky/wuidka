import { sound } from '@pixi/sound';
import type { PlayOptions } from '@pixi/sound';

type AudioCueId =
    | 'merge-small-sfx'
    | 'merge-medium-sfx'
    | 'merge-big-sfx'
    | 'combo-sfx'
    | 'danger-sfx'
    | 'gameover-sfx';

const MERGE_SMALL_MAX_TIER = 4;
const MERGE_MEDIUM_MAX_TIER = 8;

const DEFAULT_OPTIONS: PlayOptions = {
    volume: 0.7
};

const exists = (id: AudioCueId): boolean => sound.exists(id);

const play = (id: AudioCueId, options?: Partial<PlayOptions>) => {
    if (!exists(id)) {
        return;
    }
    const merged: PlayOptions = { ...DEFAULT_OPTIONS, ...options };
    sound.play(id, merged);
};

export const AudioManager = {
    init(): void {
        // Importing @pixi/sound registers the Pixi Assets middleware automatically.
        // We ensure the library is ready by touching the shared context once.
        if (!sound.context) {
            void sound.init();
        }
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

        play('merge-big-sfx', { volume: 0.75 });
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
    }
};
