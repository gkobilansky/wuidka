export interface TierConfig {
  id: number;
  name: string;
  radius: number;
  points: number;
  color: number;
  frames: string[];
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
  width: 400,  
  height: 500,
  
  // Physics settings
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
  dropRateLimit: 10, // 10 drops per 10 seconds
  
  // Tier system
  tiers: [
    {
      id: 1,
      name: "Greedy Seedy",
      radius: 20,
      points: 2,
      color: 0xff0000,
      frames: ["greedy-seedy", "greedy-seedy-1"]
    },
    {
      id: 2,
      name: "Drip Drop",
      radius: 26,
      points: 4,
      color: 0xff8000,
      frames: ["drippy-drop", "drippy-drop-1"]
    },
    {
      id: 3,
      name: "Leafy Green",
      radius: 33,
      points: 6,
      color: 0xffff00,
      frames: ["leafy-green", "leafy-green-1"]
    },
    {
      id: 4,
      name: "Funny Sunny",
      radius: 42,
      points: 8,
      color: 0x80ff00,
      frames: ["funny-sunny", "funny-sunny-1"]
    },
    {
      id: 5,
      name: "Buddy Bud",
      radius: 54,
      points: 10,
      color: 0x00ff00,
      frames: ["buddy-bud"]
    },
    {
      id: 6,
      name: "Da Grinda",
      radius: 54,
      points: 12,
      color: 0x00ff80,
      frames: ["da-grind"]
    },
    {
      id: 7,
      name: "Kief Kollection",
      radius: 70,
      points: 14,
      color: 0x00ffff,
      frames: ["kief-kollection"]
    },
    {
      id: 8,
      name: "Falshy Hashy",
      radius: 90,
      points: 16,
      color: 0x0080ff,
      frames: ["flahsy-hashy"]
    },
    {
      id: 9,
      name: "Gold Diamond",
      radius: 115,
      points: 18,
      color: 0x0000ff,
      frames: ["gold-diamond"]
    },
    {
      id: 10,
      name: "Flaming Fire",
      radius: 145,
      points: 20,
      color: 0x8000ff,
      frames: ["flaming-fire"]
    },
    {
      id: 11,
      name: "Big Stoner",
      radius: 180,
      points: 22,
      color: 0xff00ff,
      frames: ["big-stoner"],
      cap: true
    }
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
