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
  comboWindowMs: number;
  mergeRestMs: number;
  gameOverDelayMs: number;
  
  // Input settings
  dropRateLimit: number; // drops per 10 seconds
  
  // Tier system
  tiers: TierConfig[];
}

export const GAME_CONFIG: GameConfig = {
  // Logical resolution (portrait)
  width: 720,
  height: 1280,
  
  // Physics settings from PRD
  gravity: 1.6,
  restitution: 0.03, // low bounciness
  friction: 0.05,
  airFriction: 0.02,
  maxBodies: 120,
  
  // Game mechanics
  dangerLineY: 160, // pixels from top
  comboWindowMs: 2000, // 2 second combo window
  mergeRestMs: 80, // ms to wait before confirming merge
  gameOverDelayMs: 1500, // 1.5s above danger line triggers game over
  
  // Input rate limiting
  dropRateLimit: 6, // 6 drops per 10 seconds initially
  
  // Tier system from PRD
  tiers: [
    { id: 1, name: "Dot", radius: 20, points: 2 },
    { id: 2, name: "Bead", radius: 26, points: 5 },
    { id: 3, name: "Pebble", radius: 33, points: 10 },
    { id: 4, name: "Marble", radius: 42, points: 20 },
    { id: 5, name: "Orb", radius: 54, points: 35 },
    { id: 6, name: "Bubble", radius: 70, points: 55 },
    { id: 7, name: "Moonlet", radius: 90, points: 85 },
    { id: 8, name: "Planetseed", radius: 115, points: 130 },
    { id: 9, name: "Small Planet", radius: 145, points: 190 },
    { id: 10, name: "Giant Planet", radius: 180, points: 270 },
    { id: 11, name: "Star", radius: 220, points: 380 },
    { id: 12, name: "Nova", radius: 260, points: 520, cap: true }
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