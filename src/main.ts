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
import { AudioManager } from './shared/audio/audio-manager';

const INFO_MODAL_BREAKPOINT = '(max-width: 768px)';

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

const setupInfoPanel = () => {
    const panel = document.getElementById('info-panel');
    const toggle = document.getElementById('info-toggle') as HTMLButtonElement | null;
    const closeButton = panel?.querySelector<HTMLButtonElement>('.info-panel__close') ?? null;
    const backdrop = document.getElementById('info-backdrop');
    const emailForm = panel?.querySelector<HTMLFormElement>('.info-panel__form') ?? null;

    if (!panel || !toggle || !closeButton || !backdrop) {
        return;
    }

    const mediaQuery = window.matchMedia(INFO_MODAL_BREAKPOINT);
    let lastActiveElement: HTMLElement | null = null;

    const setAriaHidden = (hidden: boolean) => {
        if (hidden) {
            panel.setAttribute('aria-hidden', 'true');
        } else {
            panel.removeAttribute('aria-hidden');
        }
    };

    const applyDialogRole = () => {
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
    };

    const removeDialogRole = () => {
        panel.removeAttribute('role');
        panel.removeAttribute('aria-modal');
    };

    const openModal = () => {
        if (!mediaQuery.matches || panel.classList.contains('is-active')) {
            return;
        }
        lastActiveElement = document.activeElement as HTMLElement | null;
        panel.classList.add('is-active');
        toggle.setAttribute('aria-expanded', 'true');
        backdrop.hidden = false;
        document.body.classList.add('info-modal-open');
        setAriaHidden(false);
        applyDialogRole();
        closeButton.focus({ preventScroll: true });
    };

    const closeModal = (options: { restoreFocus?: boolean } = {}) => {
        const wasActive = panel.classList.contains('is-active');
        panel.classList.remove('is-active');
        toggle.setAttribute('aria-expanded', 'false');
        backdrop.hidden = true;
        document.body.classList.remove('info-modal-open');
        removeDialogRole();
        setAriaHidden(mediaQuery.matches);
        if (wasActive && options.restoreFocus !== false && lastActiveElement && typeof lastActiveElement.focus === 'function') {
            lastActiveElement.focus({ preventScroll: true });
        }
    };

    const handleToggleClick = () => {
        if (!mediaQuery.matches) {
            panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        if (panel.classList.contains('is-active')) {
            closeModal();
        } else {
            openModal();
        }
    };

    const handleBackdropClick = () => closeModal();
    const handleCloseClick = () => closeModal();

    const handleKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && mediaQuery.matches && panel.classList.contains('is-active')) {
            event.preventDefault();
            closeModal();
        }
    };

    const handleMediaChange = (event: MediaQueryListEvent) => {
        if (!event.matches) {
            closeModal({ restoreFocus: false });
            setAriaHidden(false);
            removeDialogRole();
        } else {
            setAriaHidden(!panel.classList.contains('is-active'));
            if (!panel.classList.contains('is-active')) {
                document.body.classList.remove('info-modal-open');
            }
        }
    };

    toggle.addEventListener('click', handleToggleClick);
    closeButton.addEventListener('click', handleCloseClick);
    backdrop.addEventListener('click', handleBackdropClick);
    document.addEventListener('keydown', handleKeydown);

    if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleMediaChange);
    } else if (typeof (mediaQuery as any).addListener === 'function') {
        (mediaQuery as any).addListener(handleMediaChange);
    }

    setAriaHidden(mediaQuery.matches && !panel.classList.contains('is-active'));
    if (!mediaQuery.matches) {
        removeDialogRole();
    }

    if (emailForm) {
        emailForm.addEventListener('submit', (event) => {
            event.preventDefault();
            emailForm.reset();
        });
    }
};

const setupSoundToggle = () => {
    const toggle = document.getElementById('sound-toggle') as HTMLButtonElement | null;
    if (!toggle) {
        return;
    }

    const glyph = toggle.querySelector<HTMLElement>('.sound-toggle__glyph');

    AudioManager.init();

    const updateButtonState = (muted: boolean) => {
        toggle.setAttribute('aria-pressed', muted ? 'true' : 'false');
        toggle.dataset.state = muted ? 'muted' : 'unmuted';
        toggle.title = muted ? 'Enable sound' : 'Mute sound';
        if (glyph) {
            glyph.textContent = muted ? '🔇' : '🔊';
        }
    };

    updateButtonState(AudioManager.isMuted());

    toggle.addEventListener('click', () => {
        const nextMuted = !AudioManager.isMuted();
        AudioManager.setMuted(nextMuted);
        updateButtonState(nextMuted);
    });
};

const boostsrap = async () => {
    applyLayoutSettings();
    registerLayoutListeners();
    setupInfoPanel();
    setupSoundToggle();

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
