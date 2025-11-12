import { fetchLeaderboard, type LeaderboardEntry } from '../../api/leaderboard-client';
import { connectivityStore, type ConnectivityState } from '../../shared/state/connectivity';

interface LeaderboardPanelOptions {
  containerId?: string;
  highlightNickname?: string | null;
  highlightUserId?: string | null;
}

export class LeaderboardPanelComponent {
  private readonly containerId: string;
  private highlightNickname: string | null;
  private highlightNicknameNormalized: string | null;
  private highlightUserId: string | null;
  private currentController: AbortController | null = null;
  private countdownElement: HTMLElement | null = null;
  private countdownTimerId: number | null = null;
  private latestEntries: LeaderboardEntry[] = [];
  private isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  constructor(options: LeaderboardPanelOptions = {}) {
    this.containerId = options.containerId ?? 'leaderboard-list';
    this.highlightNickname = options.highlightNickname?.trim() ?? null;
    this.highlightNicknameNormalized = this.highlightNickname?.toLowerCase() ?? null;
    this.highlightUserId = options.highlightUserId?.trim() ?? null;
    if (typeof window !== 'undefined') {
      // Defer until next frame to ensure heading exists
      window.setTimeout(() => this.initCountdown(), 0);
      this.isOnline = connectivityStore.isOnline();
      connectivityStore.subscribe((state) => this.handleConnectivityChange(state));
    }
  }

  public setHighlightNickname(value: string | null): void {
    this.highlightNickname = value?.trim() || null;
    this.highlightNicknameNormalized = this.highlightNickname?.toLowerCase() ?? null;
  }

  public setHighlightUserId(value: string | null): void {
    this.highlightUserId = value?.trim() || null;
  }

  public async render(): Promise<void> {
    await this.refresh();
  }

  public async refresh(options: { week?: string } = {}): Promise<void> {
    const container = this.getContainer();
    if (!container) {
      return;
    }

    if (!this.isOnline) {
      this.renderOfflineNotice(container);
      return;
    }

    this.abortInFlight();

    const controller = new AbortController();
    this.currentController = controller;

    this.renderLoading(container);

    try {
      const payload = await fetchLeaderboard({ week: options.week, signal: controller.signal });
      if (controller.signal.aborted) {
        return;
      }
      this.renderEntries(container, payload.entries);
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Failed to load leaderboard';
      this.renderError(container, message);
    } finally {
      if (this.currentController === controller) {
        this.currentController = null;
      }
    }
  }

  private getContainer(): HTMLElement | null {
    return document.getElementById(this.containerId);
  }

  private abortInFlight(): void {
    if (this.currentController) {
      this.currentController.abort();
      this.currentController = null;
    }
  }

  private renderLoading(container: HTMLElement): void {
    container.dataset.state = 'loading';
    container.innerHTML = '';

    const srStatus = document.createElement('p');
    srStatus.className = 'sr-only';
    srStatus.textContent = 'Loading leaderboard';
    container.appendChild(srStatus);

    for (let index = 0; index < 3; index++) {
      const placeholder = document.createElement('div');
      placeholder.className = 'leaderboard-placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      container.appendChild(placeholder);
    }
  }

  private renderEntries(container: HTMLElement, entries: LeaderboardEntry[]): void {
    this.latestEntries = entries;
    if (!entries?.length) {
      this.renderEmpty(container);
      return;
    }

    container.dataset.state = 'ready';
    container.innerHTML = '';

    for (const entry of entries) {
      const item = document.createElement('div');
      item.className = 'leaderboard-item';

      if (this.shouldHighlight(entry)) {
        item.classList.add('is-highlighted');
      }

      const rank = document.createElement('span');
      rank.className = 'leaderboard-rank';
      rank.textContent = entry.rank > 0 ? `${entry.rank}` : '•';

      const name = document.createElement('span');
      name.className = 'leaderboard-name';
      name.textContent = entry.nickname || 'Mystery Player';

      const score = document.createElement('span');
      score.className = 'leaderboard-score';
      score.textContent = this.formatScore(entry.score);

      item.appendChild(rank);
      item.appendChild(name);
      item.appendChild(score);

      container.appendChild(item);
    }
  }

  private renderEmpty(container: HTMLElement): void {
    this.latestEntries = [];
    container.dataset.state = 'empty';
    container.innerHTML = '';

    const empty = document.createElement('div');
    empty.className = 'leaderboard-empty';
    empty.textContent = 'No submissions yet. Be the first to set a record this week.';

    container.appendChild(empty);
  }

  private renderError(container: HTMLElement, message: string): void {
    container.dataset.state = 'error';
    container.innerHTML = '';

    const error = document.createElement('div');
    error.className = 'leaderboard-error';
    error.textContent = message;

    container.appendChild(error);
  }

  private shouldHighlight(entry: LeaderboardEntry): boolean {
    if (this.highlightUserId && entry.userId && entry.userId === this.highlightUserId) {
      return true;
    }
    if (!this.highlightNicknameNormalized) {
      return false;
    }
    return entry.nickname.trim().toLowerCase() === this.highlightNicknameNormalized;
  }

  private formatScore(value: number): string {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.max(0, value));
  }

  private renderOfflineNotice(container: HTMLElement): void {
    this.abortInFlight();
    container.innerHTML = '';
    if (this.latestEntries.length) {
      this.renderEntries(container, this.latestEntries);
    }
    container.dataset.state = 'offline';
    const notice = document.createElement('div');
    notice.className = 'leaderboard-offline-notice';
    notice.setAttribute('role', 'status');
    notice.textContent = 'Offline — leaderboard will refresh automatically when you reconnect.';
    container.appendChild(notice);
  }

  private handleConnectivityChange(state: ConnectivityState): void {
    this.isOnline = state.online;
    const container = this.getContainer();
    if (!container) {
      return;
    }
    if (!this.isOnline) {
      this.renderOfflineNotice(container);
    } else {
      this.refresh().catch((error) => console.error('Failed to refresh leaderboard after reconnect', error));
    }
  }

  private initCountdown(): void {
    this.updateCountdown();
    if (this.countdownTimerId === null) {
      this.countdownTimerId = window.setInterval(() => this.updateCountdown(), 60_000);
    }
  }

  private updateCountdown(): void {
    const element = this.getCountdownElement();
    if (!element) {
      return;
    }
    const msRemaining = this.getMillisUntilNextIsoWeek();
    if (msRemaining <= 0) {
      element.textContent = '(resetting soon)';
      return;
    }
    element.textContent = `(resets in ${this.formatDuration(msRemaining)})`;
  }

  private getCountdownElement(): HTMLElement | null {
    if (typeof document === 'undefined') {
      return null;
    }
    if (this.countdownElement && document.body.contains(this.countdownElement)) {
      return this.countdownElement;
    }
    const heading = document.querySelector('#leaderboard-panel h2');
    if (!heading) {
      return null;
    }
    let badge = heading.querySelector<HTMLElement>('.leaderboard-countdown');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'leaderboard-countdown';
      heading.appendChild(badge);
    }
    this.countdownElement = badge;
    return badge;
  }

  private getMillisUntilNextIsoWeek(reference: Date = new Date()): number {
    const now = reference;
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const utcDay = now.getUTCDay();
    const isoDay = utcDay === 0 ? 7 : utcDay;
    const daysUntilNextMonday = isoDay === 1 ? 7 : 8 - isoDay;
    const nextWeekStart = new Date(startOfToday);
    nextWeekStart.setUTCDate(startOfToday.getUTCDate() + daysUntilNextMonday);
    return nextWeekStart.getTime() - now.getTime();
  }

  private formatDuration(ms: number): string {
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const minutesPerDay = 60 * 24;
    const days = Math.floor(totalMinutes / minutesPerDay);
    const hours = Math.floor((totalMinutes % minutesPerDay) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}
