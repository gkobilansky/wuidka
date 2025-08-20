import type { LoaderOptions } from "../../entities/loader";

export const options: LoaderOptions = {
    manifest: {
        bundles: [
            {
                name: "game-pieces",
                assets: {
                    "pieces-atlas": "atlases/pieces.png",
                    "pieces-atlas-data": "atlases/pieces.json"
                }
            },
            {
                name: "ui",
                assets: {
                    "ui-atlas": "atlases/ui.png",
                    "ui-atlas-data": "atlases/ui.json"
                }
            },
            // {
            //     name: "audio",
            //     assets: {
            //         "drop-sfx": "audio/drop.wav",
            //         "merge-small-sfx": "audio/merge-small.wav",
            //         "merge-medium-sfx": "audio/merge-medium.wav",
            //         "merge-big-sfx": "audio/merge-big.wav",
            //         "combo-sfx": "audio/combo.wav",
            //         "danger-sfx": "audio/danger.wav",
            //         "gameover-sfx": "audio/gameover.wav",
            //         "background-music": "audio/background-loop.ogg"
            //     }
            // }
        ]
    }
}