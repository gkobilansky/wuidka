import { GAME_CONFIG, TierConfig, getTierById } from '../shared/config/game-config';

export class BagRandomizer {
  private bag: number[] = [];
  private readonly lowTierIds = [1, 2, 3]; // Tiers that can spawn initially
  private readonly midTierIds = [4, 5, 6]; // Tiers available after 60s
  
  constructor() {
    this.refillBag();
  }

  private refillBag(): void {
    this.bag = [];
    
    // Add low tier pieces (more common early game)
    for (let i = 0; i < 3; i++) {
      this.bag.push(...this.lowTierIds);
    }
    
    // Add some mid-tier pieces (unlocked later)
    // TODO: Make this time-based based on game duration
    this.bag.push(...this.midTierIds);
    
    // Shuffle the bag
    this.shuffleBag();
  }

  private shuffleBag(): void {
    for (let i = this.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
    }
  }

  public draw(): number {
    if (this.bag.length === 0) {
      this.refillBag();
    }
    
    return this.bag.pop()!;
  }

  public peek(): number {
    if (this.bag.length === 0) {
      this.refillBag();
    }
    
    return this.bag[this.bag.length - 1];
  }

  public updateDifficulty(gameTimeSeconds: number): void {
    // Adjust bag contents based on game time
    // This is called periodically to increase difficulty
    
    if (gameTimeSeconds < 30) {
      // First 30s: only tier 1-3, gentler
      this.lowTierIds.length = 3; // [1, 2, 3]
    } else if (gameTimeSeconds < 60) {
      // After 30s: can include tier 4
      if (!this.midTierIds.includes(4)) {
        this.midTierIds.push(4);
      }
    } else if (gameTimeSeconds < 120) {
      // After 60s: include tiers 4-6
      this.midTierIds.length = 3; // [4, 5, 6]
    } else {
      // After 120s: occasional tier 7
      if (!this.midTierIds.includes(7)) {
        this.midTierIds.push(7);
      }
    }
  }
}

export class Spawner {
  private bagRandomizer: BagRandomizer;
  private currentTierId: number;
  private nextTierId: number;
  private dropHistory: number[] = []; // Timestamps of recent drops
  private gameStartTime: number;

  constructor() {
    this.bagRandomizer = new BagRandomizer();
    this.gameStartTime = Date.now();
    
    // Initialize current and next pieces
    this.currentTierId = this.bagRandomizer.draw();
    this.nextTierId = this.bagRandomizer.draw();
    
  }

  public getCurrentTier(): TierConfig {
    const tier = getTierById(this.currentTierId);
    if (!tier) {
      throw new Error(`Invalid tier ID: ${this.currentTierId}`);
    }
    return tier;
  }

  public getNextTier(): TierConfig {
    const tier = getTierById(this.nextTierId);
    if (!tier) {
      throw new Error(`Invalid tier ID: ${this.nextTierId}`);
    }
    return tier;
  }

  public canDrop(): boolean {
    const now = Date.now();
    const rateWindow = 10 * 1000; // 10 seconds in milliseconds
    
    // Clean up old entries
    this.dropHistory = this.dropHistory.filter(timestamp => 
      now - timestamp < rateWindow
    );
    
    // Check if we're under the rate limit
    return this.dropHistory.length < GAME_CONFIG.dropRateLimit;
  }

  public consumePiece(): TierConfig {
    if (!this.canDrop()) {
      throw new Error('Drop rate limit exceeded');
    }
    
    // Record this drop
    this.dropHistory.push(Date.now());
    
    // Get current piece
    const currentTier = this.getCurrentTier();
    
    // Advance to next piece
    this.currentTierId = this.nextTierId;
    this.nextTierId = this.bagRandomizer.draw();
    
    // Update difficulty based on game time
    this.updateDifficulty();
    
    return currentTier;
  }


  private updateDifficulty(): void {
    const gameTimeSeconds = (Date.now() - this.gameStartTime) / 1000;
    this.bagRandomizer.updateDifficulty(gameTimeSeconds);
  }

  public getDropCooldownProgress(): number {
    if (this.canDrop()) return 1.0; // Ready to drop
    
    const now = Date.now();
    const rateWindow = 10 * 1000; // 10 seconds
    
    // Find the oldest drop that's still counting against us
    const oldestRelevantDrop = Math.min(...this.dropHistory);
    const timeSinceOldest = now - oldestRelevantDrop;
    
    return Math.min(1.0, timeSinceOldest / rateWindow);
  }

  public getGameTimeSeconds(): number {
    return (Date.now() - this.gameStartTime) / 1000;
  }

  public reset(): void {
    this.bagRandomizer = new BagRandomizer();
    this.dropHistory = [];
    this.gameStartTime = Date.now();
    
    this.currentTierId = this.bagRandomizer.draw();
    this.nextTierId = this.bagRandomizer.draw();
    
  }
}