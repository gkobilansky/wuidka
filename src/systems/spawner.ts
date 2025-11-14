import { GAME_CONFIG, TierConfig, getTierById } from '../shared/config/game-config';

export class BagRandomizer {
  private bag: number[] = [];
  private readonly allowedTierIds: number[];
  
  constructor() {
    this.allowedTierIds = [...GAME_CONFIG.allowedSpawnTierIds];
    if (this.allowedTierIds.length === 0) {
      throw new Error('No allowed spawn tier IDs configured');
    }
    this.refillBag();
  }

  private refillBag(): void {
    this.bag = [];
    
    // Add all allowed tier pieces evenly
    for (let i = 0; i < 2; i++) {
      this.bag.push(...this.allowedTierIds);
    }
    
    // Shuffle the bag
    this.shuffleBag();
  }

  private shuffleBag(): void {
    for (let i = this.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
    }
  }

  public draw(turnCount: number = 0): number {
    if (turnCount < 2) {
      return 1;
    }
    
    if (this.bag.length === 0) {
      this.refillBag();
    }
    
    return this.bag.pop()!;
  }
}

export class Spawner {
  private bagRandomizer: BagRandomizer;
  private currentTierId: number;
  private nextTierId: number;
  private dropHistory: number[] = []; // Timestamps of recent drops
  private gameStartTime: number;
  private turnCount: number = 0; // Track number of turns (pieces consumed)

  constructor() {
    this.bagRandomizer = new BagRandomizer();
    this.gameStartTime = Date.now();
    
    // Initialize current and next pieces based on turn count
    this.currentTierId = this.bagRandomizer.draw(this.turnCount);
    this.nextTierId = this.bagRandomizer.draw(this.turnCount + 1);
    
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
    const rateWindow = 10 * 200; // 3 seconds in milliseconds
    
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
    
    // Increment turn count
    this.turnCount++;
    
    // Advance to next piece based on turn count
    this.currentTierId = this.nextTierId;
    this.nextTierId = this.bagRandomizer.draw(this.turnCount + 1);
    
    return currentTier;
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
    this.turnCount = 0;
    
    this.currentTierId = this.bagRandomizer.draw(this.turnCount);
    this.nextTierId = this.bagRandomizer.draw(this.turnCount + 1);
    
  }

  public getTurnCount(): number {
    return this.turnCount;
  }
}
