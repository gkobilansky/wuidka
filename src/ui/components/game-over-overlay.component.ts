import { PixiContainer, PixiGraphics, PixiText } from '../../plugins/engine';
import { ButtonSprite } from '../sprites';
import { connectivityStore, type ConnectivityState } from '../../shared/state/connectivity';

export interface ScoreSubmissionPayload {
  nickname: string;
  email?: string;
  score: number;
}

export interface ScoreSubmissionResult {
  placement: number;
  isoWeek: string;
  entry: {
    id: string;
    userId?: string | null;
    nickname: string;
    score: number;
    isoWeek: string;
    createdAt: string;
  };
}

export interface SubmitScoreHandler {
  (payload: ScoreSubmissionPayload, options?: { signal?: AbortSignal }): Promise<ScoreSubmissionResult>;
}

interface GameOverOverlayOptions {
  width: number;
  height: number;
  score: number;
  onRestart: () => void;
  onSubmitScore?: SubmitScoreHandler;
  onSubmissionSuccess?: (result: ScoreSubmissionResult, payload: ScoreSubmissionPayload) => void;
}

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error' | 'skipped';

interface StoredProfile {
  nickname: string;
  email?: string;
}

const PLAYER_PROFILE_KEY = 'wuidka-player-profile';
const FORM_DISMISS_DELAY_MS = 800;

export class GameOverOverlayComponent extends PixiContainer {
  private readonly background: PixiGraphics;
  private readonly titleText: PixiText;
  private readonly scoreText: PixiText;
  private readonly restartButton: ButtonSprite;
  private readonly options: GameOverOverlayOptions;
  private readonly score: number;

  private formHost: HTMLDivElement | null = null;
  private formElement: HTMLFormElement | null = null;
  private nicknameInput: HTMLInputElement | null = null;
  private emailInput: HTMLInputElement | null = null;
  private submitButton: HTMLButtonElement | null = null;
  private skipButton: HTMLButtonElement | null = null;
  private statusText: HTMLParagraphElement | null = null;
  private submissionAbortController: AbortController | null = null;
  private dismissTimeoutId: number | null = null;
  private connectivityUnsubscribe: (() => void) | null = null;
  private isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
  private offlineStatusSnapshot: { text: string; state: SubmissionState } | null = null;
  private submissionState: SubmissionState = 'idle';

  private readonly handleRestart = () => {
    this.abortInFlight();
    this.options.onRestart();
  };

  private readonly handleFormSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    this.submitScore();
  };

  private readonly handleSkipClick = () => {
    this.persistProfile();
    this.setSubmissionState('skipped', 'Skipping submission this round. Start over when ready.');
  };

  constructor(options: GameOverOverlayOptions) {
    super();
    this.options = options;

    const { width, height, score } = options;
    this.score = score;
    this.interactive = true;

    this.background = new PixiGraphics();
    this.background.rect(0, 0, width, height);
    this.background.fill({ color: 0x000000 });
    this.background.alpha = 0.55;
    this.addChild(this.background);

    this.titleText = new PixiText({
      text: 'Game Over',
      style: {
        fontFamily: 'Arial',
        fontSize: 48,
        fill: 0xffffff,
        fontWeight: '900',
        align: 'center',
        stroke: { color: 0x000000, width: 4 },
        dropShadow: {
          color: 0x000000,
          blur: 2,
          distance: 2,
          alpha: 1
        }
      }
    });
    this.titleText.anchor.set(0.5);
    this.titleText.position.set(width / 2, height / 2 - 70);
    this.addChild(this.titleText);

    this.scoreText = new PixiText({
      text: this.formatScore(score),
      style: {
        fontFamily: 'Arial',
        fontSize: 28,
        fill: 0xffffff,
        fontWeight: '700',
        align: 'center',
        stroke: { color: 0x000000, width: 3 },
        dropShadow: {
          color: 0x000000,
          blur: 2,
          distance: 2,
          alpha: 1
        }
      }
    });
    this.scoreText.anchor.set(0.5);
    this.scoreText.position.set(width / 2, this.titleText.position.y + 56);
    this.addChild(this.scoreText);

    const buttonWidth = 200;
    const buttonHeight = 52;
    this.restartButton = new ButtonSprite({
      text: 'Start Over',
      width: buttonWidth,
      height: buttonHeight,
      backgroundColor: 0x3b82f6,
      borderColor: 0x1d4ed8,
      textColor: 0xffffff,
      fontSize: 20
    });
    this.restartButton.position.set((width - buttonWidth) / 2, this.scoreText.position.y + 40);
    this.addChild(this.restartButton);
    this.restartButton.on('pointertap', this.handleRestart);

    this.mountDomForm();
  }

  public updateScore(score: number): void {
    this.scoreText.text = this.formatScore(score);
  }

  override destroy(options?: any): void {
    this.restartButton.off('pointertap', this.handleRestart);
    this.teardownDomForm();
    super.destroy(options);
  }

  private formatScore(score: number): string {
    return `Score: ${score}`;
  }

  private mountDomForm(): void {
    const host = document.getElementById('game-container');
    if (!host) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'game-over-form';
    wrapper.setAttribute('role', 'dialog');
    wrapper.setAttribute('aria-live', 'polite');

    const heading = document.createElement('h3');
    heading.textContent = 'Submit Your Harvest';

    const description = document.createElement('p');
    description.className = 'game-over-form__description';
    description.textContent = 'Share your nickname for the weekly top five. Email is optional and only used for prizes.';

    const form = document.createElement('form');
    form.className = 'game-over-form__fields';
    form.noValidate = true;
    form.addEventListener('submit', this.handleFormSubmit);

    const nicknameLabel = document.createElement('label');
    nicknameLabel.textContent = 'Nickname';
    nicknameLabel.htmlFor = 'game-over-nickname';

    const nicknameInput = document.createElement('input');
    nicknameInput.id = 'game-over-nickname';
    nicknameInput.name = 'nickname';
    nicknameInput.required = true;
    nicknameInput.maxLength = 24;
    nicknameInput.placeholder = 'Legendary Farmer';
    nicknameInput.autocomplete = 'username';

    const emailLabel = document.createElement('label');
    emailLabel.textContent = 'Email (optional)';
    emailLabel.htmlFor = 'game-over-email';

    const emailInput = document.createElement('input');
    emailInput.id = 'game-over-email';
    emailInput.name = 'email';
    emailInput.type = 'email';
    emailInput.placeholder = 'you@example.com';
    emailInput.autocomplete = 'email';

    const actions = document.createElement('div');
    actions.className = 'game-over-form__actions';

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.textContent = 'Submit Score';

    const skipButton = document.createElement('button');
    skipButton.type = 'button';
    skipButton.textContent = 'Skip for now';
    skipButton.addEventListener('click', this.handleSkipClick);

    const status = document.createElement('p');
    status.className = 'game-over-form__status';
    status.setAttribute('aria-live', 'polite');
    status.textContent = '';

    actions.appendChild(submitButton);
    actions.appendChild(skipButton);

    form.appendChild(nicknameLabel);
    form.appendChild(nicknameInput);
    form.appendChild(emailLabel);
    form.appendChild(emailInput);
    form.appendChild(actions);

    wrapper.appendChild(heading);
    wrapper.appendChild(description);
    wrapper.appendChild(form);
    wrapper.appendChild(status);

    host.appendChild(wrapper);

    const stored = this.loadStoredProfile();
    if (stored?.nickname) {
      nicknameInput.value = stored.nickname;
    }
    if (stored?.email) {
      emailInput.value = stored.email;
    }

    nicknameInput.focus({ preventScroll: true });

    this.formHost = wrapper;
    this.formElement = form;
    this.nicknameInput = nicknameInput;
    this.emailInput = emailInput;
    this.submitButton = submitButton;
    this.skipButton = skipButton;
    this.statusText = status;

    this.connectivityUnsubscribe = connectivityStore.subscribe(this.handleConnectivityChange);
  }

  private teardownDomForm(): void {
    this.abortInFlight();
    if (this.dismissTimeoutId !== null) {
      window.clearTimeout(this.dismissTimeoutId);
      this.dismissTimeoutId = null;
    }
    if (this.formElement) {
      this.formElement.removeEventListener('submit', this.handleFormSubmit);
    }
    if (this.skipButton) {
      this.skipButton.removeEventListener('click', this.handleSkipClick);
    }
    if (this.connectivityUnsubscribe) {
      this.connectivityUnsubscribe();
      this.connectivityUnsubscribe = null;
    }
    this.formHost?.remove();
    this.formHost = null;
    this.formElement = null;
    this.nicknameInput = null;
    this.emailInput = null;
    this.submitButton = null;
    this.skipButton = null;
    this.statusText = null;
  }

  private async submitScore(): Promise<void> {
    if (!this.options.onSubmitScore) {
      this.setSubmissionState('error', 'Score submission is currently unavailable.');
      return;
    }
    if (!this.isOnline) {
      this.showOfflineStatus();
      return;
    }
    const nickname = this.nicknameInput?.value.trim() ?? '';
    const email = this.emailInput?.value.trim();

    if (!nickname) {
      this.setSubmissionState('error', 'Nickname is required.');
      this.nicknameInput?.focus();
      return;
    }

    this.setSubmissionState('submitting', 'Submitting score...');

    const payload: ScoreSubmissionPayload = {
      nickname,
      email: email?.length ? email : undefined,
      score: this.score
    };

    this.abortInFlight();
    const controller = new AbortController();
    this.submissionAbortController = controller;

    try {
      const result = await this.options.onSubmitScore(payload, { signal: controller.signal });
      if (controller.signal.aborted) {
        return;
      }
      this.persistProfile(payload);
      this.setSubmissionState('success', `Nice! You're #${Math.max(1, result.placement)} this week.`);
      this.options.onSubmissionSuccess?.(result, payload);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Failed to submit score.';
      this.setSubmissionState('error', message);
    } finally {
      if (this.submissionAbortController === controller) {
        this.submissionAbortController = null;
      }
    }
  }

  private setSubmissionState(state: SubmissionState, message?: string): void {
    this.submissionState = state;
    this.offlineStatusSnapshot = null;
    const hasCompleted = state === 'success' || state === 'skipped';

    this.updateSubmitInteractivity();
    if (this.statusText) {
      this.statusText.textContent = message ?? '';
      this.statusText.dataset.state = state;
    }

    if (hasCompleted) {
      this.scheduleFormDismissal();
    }
  }

  private abortInFlight(): void {
    if (this.submissionAbortController) {
      this.submissionAbortController.abort();
      this.submissionAbortController = null;
    }
  }

  private scheduleFormDismissal(): void {
    const host = this.formHost;
    if (!host) {
      return;
    }
    host.classList.add('game-over-form--dismissed');
    host.setAttribute('aria-hidden', 'true');
    if (this.dismissTimeoutId !== null) {
      window.clearTimeout(this.dismissTimeoutId);
    }
    this.dismissTimeoutId = window.setTimeout(() => {
      this.dismissTimeoutId = null;
      this.teardownDomForm();
    }, FORM_DISMISS_DELAY_MS);
  }

  private loadStoredProfile(): StoredProfile | null {
    try {
      const raw = window.localStorage.getItem(PLAYER_PROFILE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as StoredProfile;
    } catch {
      return null;
    }
  }

  private persistProfile(profile?: ScoreSubmissionPayload): void {
    const nickname = profile?.nickname ?? this.nicknameInput?.value.trim();
    const email = profile?.email ?? this.emailInput?.value.trim();
    if (!nickname) {
      return;
    }
    try {
      const payload: StoredProfile = {
        nickname,
        ...(email ? { email } : {})
      };
      window.localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage errors (e.g., private mode)
    }
  }

  private updateSubmitInteractivity(): void {
    const isSubmitting = this.submissionState === 'submitting';
    const hasCompleted = this.submissionState === 'success' || this.submissionState === 'skipped';
    if (this.submitButton) {
      this.submitButton.disabled = !this.isOnline || isSubmitting || hasCompleted;
    }
    if (this.skipButton) {
      this.skipButton.disabled = isSubmitting || this.submissionState === 'success';
    }
    this.restartButton.setEnabled(!isSubmitting);
  }

  private readonly handleConnectivityChange = (state: ConnectivityState) => {
    this.isOnline = state.online;
    this.updateSubmitInteractivity();
    if (!this.isOnline) {
      this.showOfflineStatus();
    } else {
      this.restoreOfflineStatus();
    }
  };

  private showOfflineStatus(): void {
    if (!this.statusText) {
      return;
    }
    if (this.submissionState === 'success' || this.submissionState === 'skipped') {
      return;
    }
    if (!this.offlineStatusSnapshot) {
      this.offlineStatusSnapshot = {
        text: this.statusText.textContent ?? '',
        state: (this.statusText.dataset.state as SubmissionState) ?? 'idle'
      };
    }
    this.statusText.textContent = 'Offline — score submissions resume once you reconnect.';
    this.statusText.dataset.state = 'offline';
    if (this.submitButton) {
      this.submitButton.disabled = true;
    }
  }

  private restoreOfflineStatus(): void {
    if (!this.statusText) {
      return;
    }
    if (this.statusText.dataset.state !== 'offline') {
      this.offlineStatusSnapshot = null;
      return;
    }
    if (this.offlineStatusSnapshot) {
      this.statusText.textContent = this.offlineStatusSnapshot.text;
      this.statusText.dataset.state = this.offlineStatusSnapshot.state;
    } else {
      this.statusText.textContent = '';
      this.statusText.dataset.state = this.submissionState;
    }
    this.offlineStatusSnapshot = null;
  }
}
