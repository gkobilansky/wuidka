import './style.css';
import '@pixi/gif';
import { App } from './app';
import { Manager } from './entities/manager';
import { IPixiApplicationOptions, PixiAssets } from './plugins/engine';
import { Loader } from './entities/loader';
import { options } from './shared/config/manifest';
import { LoaderScene } from './ui/scenes/loader.scene';
import { GameScene } from './ui/scenes/game.scene';
import { ScorePanelComponent } from './ui/components/score-panel.component';
import { GAME_CONFIG } from './shared/config/game-config';

const applyLayoutSettings = () => {
    const root = document.documentElement;
    root.style.setProperty('--game-width', `${GAME_CONFIG.width}`);
    root.style.setProperty('--game-height', `${GAME_CONFIG.height}`);
    root.style.setProperty('--game-width-px', `${GAME_CONFIG.width}px`);
    root.style.setProperty('--game-height-px', `${GAME_CONFIG.height}px`);
};

const registerLayoutListeners = () => {
    window.addEventListener('resize', applyLayoutSettings, { passive: true });
};

const boostsrap = async () => {
    applyLayoutSettings();
    registerLayoutListeners();

    const canvas = document.getElementById("pixi-screen") as HTMLCanvasElement;
    const gameContainer = document.getElementById('game-container');
    const resizeTo = gameContainer ?? window;
    const resolution = window.devicePixelRatio || 1;
    const autoDensity = true;
    const backgroundColor = 'rgba(227, 255, 171, 1)';
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
    const scorePanel = new ScorePanelComponent();
    const loaderScene = new LoaderScene();
    Manager.changeScene(loaderScene);
    loader.download(options, loaderScene.progressCallback.bind(loaderScene)).then(() => {
        Manager.changeScene(new GameScene());
        scorePanel.render();
    });
}

boostsrap();
