import type { LoaderOptions } from "../../entities/loader";

export const AUDIO_ASSET_URLS = {
    "merge-small-sfx": "sound/merge-small.wav",
    "merge-medium-sfx": "sound/merge-medium.wav",
    "merge-big-sfx": "sound/merge-large.wav",
    "merge-xl-sfx": "sound/merge-xl.wav",
    "combo-sfx": "sound/combo.wav",
    "danger-sfx": "sound/danger.wav",
    "gameover-sfx": "sound/gameover.wav"
} as const;

export const options: LoaderOptions = {
    manifest: {
        bundles: [
            {
                name: "game-pieces",
                assets: {
                    "pieces-atlas": "atlases/wuidka-pieces/spritesheet.png",
                    "pieces-atlas-data": "atlases/wuidka-pieces/spritesheet.json"
                }
            },
            {
                name: "ui",
                assets: {
                    "ui-atlas": "atlases/ui.png",
                    "ui-atlas-data": "atlases/ui.json"
                }
            },
            {
                name: "effects",
                assets: {
                    "cloud-transform-1": "cloud-transform/1.png",
                    "cloud-transform-2": "cloud-transform/2.png",
                    "cloud-transform-3": "cloud-transform/3.png",
                    "cloud-transform-4": "cloud-transform/4.png"
                }
            },
            {
                name: "audio",
                assets: AUDIO_ASSET_URLS
            }
        ]
    }
}
