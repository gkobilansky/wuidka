import './style.css';
import '@pixi/gif';
import { inject } from '@vercel/analytics';
import { App } from './app';
import { Manager } from './entities/manager';
import { IPixiApplicationOptions, PixiAssets } from './plugins/engine';
import { Loader } from './entities/loader';
import { options } from './shared/config/manifest';
import { LoaderScene } from './ui/scenes/loader.scene';
import { GameScene } from './ui/scenes/game.scene';
import { ScorePanelComponent } from './ui/components/score-panel.component';
import { LeaderboardPanelComponent } from './ui/components/leaderboard-panel.component';
import { GAME_CONFIG } from './shared/config/game-config';
import { AudioManager } from './shared/audio/audio-manager';
import { registerLeaderboardPanel } from './ui/state/leaderboard-registry';
import { submitUserContact } from './api/users-client';
import { registerSW } from 'virtual:pwa-register';
import { connectivityStore, ConnectivityState } from './shared/state/connectivity';

const INFO_MODAL_BREAKPOINT = '(max-width: 768px)';

connectivityStore.init();
inject();

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
        const emailInput = emailForm.querySelector<HTMLInputElement>('#info-email');
        const submitButton = emailForm.querySelector<HTMLButtonElement>('button[type="submit"]');
        const statusElement = panel.querySelector<HTMLElement>('.info-panel__form-status');

        type FormStatusState = 'idle' | 'pending' | 'success' | 'error' | 'offline';
        let statusSnapshotBeforeOffline: { text: string; state: FormStatusState } | null = null;

        const setStatus = (message: string, state: FormStatusState) => {
            if (!statusElement) {
                return;
            }
            statusSnapshotBeforeOffline = null;
            statusElement.textContent = message;
            statusElement.dataset.state = state;
        };

        const showOfflineStatus = () => {
            if (!statusElement) {
                return;
            }
            if (!statusSnapshotBeforeOffline) {
                statusSnapshotBeforeOffline = {
                    text: statusElement.textContent ?? '',
                    state: (statusElement.dataset.state as FormStatusState) ?? 'idle'
                };
            }
            statusElement.textContent = 'Offline — submissions resume once you reconnect.';
            statusElement.dataset.state = 'offline';
        };

        const restoreOfflineStatus = () => {
            if (!statusElement) {
                return;
            }
            if (statusElement.dataset.state !== 'offline') {
                statusSnapshotBeforeOffline = null;
                return;
            }
            if (statusSnapshotBeforeOffline) {
                statusElement.textContent = statusSnapshotBeforeOffline.text;
                statusElement.dataset.state = statusSnapshotBeforeOffline.state;
            } else {
                statusElement.textContent = '';
                statusElement.dataset.state = 'idle';
            }
            statusSnapshotBeforeOffline = null;
        };

        let isSubmitting = false;
        let isOnline = connectivityStore.isOnline();

        const applyConnectivityState = (state: ConnectivityState) => {
            isOnline = state.online;
            const offline = !isOnline;
            if (submitButton) {
                submitButton.disabled = offline || isSubmitting;
            }
            if (offline) {
                showOfflineStatus();
            } else {
                restoreOfflineStatus();
            }
        };

        if (typeof window !== 'undefined') {
            connectivityStore.subscribe(applyConnectivityState);
        }

        emailForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (isSubmitting) {
                return;
            }
            if (!isOnline) {
                showOfflineStatus();
                return;
            }

            const emailValue = emailInput?.value.trim() ?? '';
            if (!emailValue) {
                setStatus('Please enter a valid email.', 'error');
                emailInput?.focus();
                return;
            }

            isSubmitting = true;
            submitButton && (submitButton.disabled = true);
            setStatus('Saving...', 'pending');

            try {
                await submitUserContact({ email: emailValue });
                setStatus('Thanks! You are on the list. 🌱', 'success');
                emailForm.reset();
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to save email.';
                setStatus(message, 'error');
            } finally {
                isSubmitting = false;
                if (submitButton) {
                    submitButton.disabled = !isOnline;
                }
            }
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
    const leaderboardPanel = new LeaderboardPanelComponent();
    registerLeaderboardPanel(leaderboardPanel);
    const loaderScene = new LoaderScene();
    Manager.changeScene(loaderScene);
    loader.download(options, loaderScene.progressCallback.bind(loaderScene)).then(() => {
        Manager.changeScene(new GameScene());
        scorePanel.render();
        leaderboardPanel.render().catch((error) => {
            console.error('Failed to render leaderboard panel', error);
        });
    });
}

const registerServiceWorker = () =>
    registerSW({
        immediate: true,
        onRegisteredSW(swUrl, registration) {
            if (swUrl) {
                console.info('PWA service worker registered', swUrl);
            }
            if (registration?.waiting) {
                console.info('PWA service worker waiting to activate');
            }
        },
        onRegisterError(error) {
            console.error('PWA service worker registration failed', error);
        }
    });

boostsrap()
    .catch((error) => {
        console.error('Failed to bootstrap application', error);
    })
    .finally(() => {
        registerServiceWorker();
    });
