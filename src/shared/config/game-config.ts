export interface TierConfig {
  id: number;
  name: string;
  radius: number;
  points: number;
  cap?: boolean;
}

export interface GameConfig {
  // Display settings
  width: number;
  height: number;
  
  // Physics settings
  gravity: number;
  restitution: number;
  friction: number;
  airFriction: number;
  maxBodies: number;
  
  // Game mechanics
  dangerLineY: number;
  dangerTurnLimit: number; // turns a piece can remain in danger
  dangerFallVyThreshold: number; // minimum downward vy to consider a piece "falling"
  dangerSuppressMs: number; // hide danger line briefly after a drop
  comboWindowMs: number;
  mergeRestMs: number;
  
  // Input settings
  dropRateLimit: number; // drops per 10 seconds
  
  // Tier system
  tiers: TierConfig[];
}

export const GAME_CONFIG: GameConfig = {
  // Mobile-friendly resolution (narrower game board)
  width: 400,  
  height: 700,
  
  // Physics settings from PRD
  gravity: 1.6,
  restitution: 0.3, // moderate bounce
  friction: 0.05,
  airFriction: 0.02,
  maxBodies: 120,
  
  // Game mechanics
  dangerLineY: 60, // pixels from top
  dangerTurnLimit: 4, // turns a piece can remain in danger zone
  dangerFallVyThreshold: 0.5, // hide danger while pieces are falling faster than this vy
  dangerSuppressMs: 1500, // hide danger line for 1.5s after each turn
  comboWindowMs: 2000, // 2 second combo window
  mergeRestMs: 50, // ms to wait before confirming merge
  
  // Input rate limiting
  dropRateLimit: 6, // 6 drops per 10 seconds initially
  
  // Tier system from PRD
  tiers: [
    { id: 1, name: "Greedy Seedy", radius: 20, points: 2 },
    { id: 2, name: "Drip Drop", radius: 26, points: 5 },
    { id: 3, name: "Leafy Green", radius: 33, points: 10 },
    { id: 4, name: "Funny Sunny", radius: 42, points: 20 },
    { id: 5, name: "Da Grinda", radius: 54, points: 35 },
    { id: 6, name: "Kief Kollection", radius: 70, points: 55 },
    { id: 7, name: "Falshy Hashy", radius: 90, points: 85 },
    { id: 8, name: "Gold Diamond", radius: 115, points: 130 },
    { id: 9, name: "Flaming Fire", radius: 145, points: 190 },
    { id: 10, name: "Big Stoner", radius: 180, points: 270, cap: true } // max tie,
  ]
};

// Helper functions
export const getTierById = (id: number): TierConfig | undefined => {
  return GAME_CONFIG.tiers.find(tier => tier.id === id);
};

export const getNextTier = (currentTierId: number): TierConfig | undefined => {
  const nextId = currentTierId + 1;
  return getTierById(nextId);
};

export const canMerge = (tierId: number): boolean => {
  const tier = getTierById(tierId);
  return tier ? !tier.cap : false;
};
