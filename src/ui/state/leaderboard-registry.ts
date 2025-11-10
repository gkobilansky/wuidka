import type { LeaderboardPanelComponent } from '../components/leaderboard-panel.component';

let instance: LeaderboardPanelComponent | null = null;

export function registerLeaderboardPanel(panel: LeaderboardPanelComponent): void {
  instance = panel;
}

export function getLeaderboardPanel(): LeaderboardPanelComponent | null {
  return instance;
}
