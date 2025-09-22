import './style.css';
import '@pixi/gif';
import { App } from './app';
import { FILL_COLOR } from './shared/constant/constants';
import { Manager } from './entities/manager';
import { IPixiApplicationOptions, PixiAssets } from './plugins/engine';
import { Loader } from './entities/loader';
import { options } from './shared/config/manifest';
import { GAME_CONFIG, canMerge } from './shared/config/game-config';
import { LoaderScene } from './ui/scenes/loader.scene';
import { GameScene } from './ui/scenes/game.scene';

const boostsrap = async () => {
    const canvas = document.getElementById("pixi-screen") as HTMLCanvasElement;
    const resizeTo = window;
    const resolution = window.devicePixelRatio || 1;
    const autoDensity = true;
    const backgroundColor = FILL_COLOR;
    const appOptions: Partial<IPixiApplicationOptions> = {
        canvas,
        resizeTo,
        resolution,
        autoDensity,
        backgroundColor
    }

    const application = new App();
    await application.init(appOptions);

    Manager.init(application);
    const loader = new Loader(PixiAssets);
    const loaderScene = new LoaderScene();
    Manager.changeScene(loaderScene);
    loader.download(options, loaderScene.progressCallback.bind(loaderScene)).then(() => {
        Manager.changeScene(new GameScene());
    });
}

boostsrap();

// Render scoring table next to the canvas using DOM
function renderScorePanel(): void {
    const list = document.getElementById('score-list');
    if (!list) return;

    const colors = [
        0xff0000, 0xff8000, 0xffff00, 0x80ff00, 0x00ff00, 0x00ff80,
        0x00ffff, 0x0080ff, 0x0000ff, 0x8000ff, 0xff00ff, 0xff0080
    ];
    const colorFor = (tierId: number) => '#' + colors[(tierId - 1) % colors.length].toString(16).padStart(6, '0');

    list.innerHTML = '';

    for (const tier of GAME_CONFIG.tiers) {
        if (!canMerge(tier.id)) continue; // skip capped tier
        const item = document.createElement('div');
        item.className = 'score-item';

        const thumb = document.createElement('div');
        thumb.className = 'score-thumb';
        thumb.style.backgroundColor = colorFor(tier.id);
        item.appendChild(thumb);

        const meta = document.createElement('div');
        meta.className = 'score-meta';
        const name = document.createElement('div');
        name.className = 'score-name';
        name.textContent = `${tier.name}`;
        meta.appendChild(name);
        item.appendChild(meta);

        const value = document.createElement('div');
        value.className = 'score-value';
        value.textContent = `${tier.points}`; // large number only
        item.appendChild(value);

        list.appendChild(item);
    }
}

// Call once on load
renderScorePanel();
